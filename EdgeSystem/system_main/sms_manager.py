import serial
import time
import threading

from system_main.phone_utils import normalize_ph_mobile, format_for_gsm, format_for_gsm_intl


class SMSManager:
    _lock = threading.Lock()

    def __init__(self, port="/dev/ttyUSB2", baudrate=115200):
        self.port = port
        self.baudrate = baudrate
        print(f" [GSM] Configured SIM7600 on {self.port} @ {self.baudrate}.")

    def send_gsm_only(self, phone_number, message, *, fast=False):
        """Send via SIM7600 only (backend MQTT fallback and offline alerts)."""
        ten = normalize_ph_mobile(phone_number)
        if not ten:
            print(f" [GSM] CONFIG: invalid phone number for GSM: {phone_number}")
            return False
        text = (message or "").strip()
        if not text:
            print(" [GSM] CONFIG: empty message")
            return False
        # Try 09XXXXXXXXX first (typical PH SIM7600), then +63XXXXXXXXXX.
        for dial in (format_for_gsm(ten), format_for_gsm_intl(ten)):
            if dial and self._send_via_gsm(dial, text, fast=fast):
                return True
        return False

    def probe_module(self):
        """Quick AT check at startup (does not send SMS)."""
        with self._lock:
            try:
                ser = serial.Serial(self.port, self.baudrate, timeout=3)
                ser.reset_input_buffer()
                ser.write(b"AT\r")
                time.sleep(0.4)
                boot = ser.read_all().decode(errors="ignore")
                ser.write(b"AT+CPIN?\r")
                time.sleep(0.4)
                pin = ser.read_all().decode(errors="ignore")
                ser.write(b"AT+CSQ\r")
                time.sleep(0.4)
                csq = ser.read_all().decode(errors="ignore")
                ser.close()
                ready = "READY" in pin.upper()
                print(f" [GSM] Probe {self.port}: CPIN={pin.strip()!r} CSQ={csq.strip()!r}")
                if not ready:
                    print(" [GSM] WARNING: SIM may not be ready (check PIN, load, antenna).")
                return ready
            except Exception as e:
                print(f" [GSM] Probe failed on {self.port}: {e}")
                return False

    def _send_via_gsm(self, dial_number, message, *, fast=False):
        at_wait = 0.25 if fast else 0.4
        prompt_timeout = 6.0 if fast else 8.0
        send_wait = 4.0 if fast else 7.0
        with self._lock:
            try:
                print(f" [GSM] Sending to {dial_number} via {self.port}...")
                ser = serial.Serial(self.port, self.baudrate, timeout=2 if fast else 3)

                def _at(cmd, wait=None):
                    w = at_wait if wait is None else wait
                    ser.reset_input_buffer()
                    ser.write(cmd if isinstance(cmd, bytes) else cmd.encode())
                    time.sleep(w)
                    return ser.read_all().decode(errors="ignore")

                if "OK" not in _at(b"AT\r"):
                    print(f" [GSM] HARDWARE: no AT OK on {self.port}")
                    ser.close()
                    return False
                _at(b"ATE0\r")
                _at(b'AT+CSCS="GSM"\r')
                _at(b"AT+CMGF=1\r")

                ser.reset_input_buffer()
                ser.write(f'AT+CMGS="{dial_number}"\r'.encode())

                start_time = time.time()
                prompt_received = False
                while time.time() - start_time < prompt_timeout:
                    if ser.in_waiting > 0:
                        chunk = ser.read_all().decode(errors="ignore")
                        if ">" in chunk:
                            prompt_received = True
                            break
                    time.sleep(0.05 if fast else 0.1)

                if not prompt_received:
                    print(
                        f" [GSM] HARDWARE: no CMGS prompt for {dial_number} on {self.port} — "
                        "SIM not ready, wrong port, or module busy."
                    )
                    ser.close()
                    return False

                # GSM 7-bit; OTP templates are ASCII.
                ser.write(f"{message}\x1A".encode("ascii", errors="replace"))
                time.sleep(send_wait)

                response = ser.read_all().decode(errors="ignore")
                ser.close()

                if "OK" in response or "+CMGS:" in response:
                    print(f" [GSM] OK: message accepted by module for {dial_number}.")
                    return True
                if "ERROR" in response.upper():
                    print(f" [GSM] HARDWARE: module ERROR for {dial_number}: {response!r}")
                else:
                    print(f" [GSM] HARDWARE: send failed for {dial_number}: {response!r}")
                return False

            except Exception as e:
                err = str(e)
                if "busy" in err.lower() or getattr(e, "errno", None) == 16:
                    print(
                        f" [GSM] PORT BUSY on {self.port}: {e}\n"
                        "       Stop other programs using this port first:\n"
                        "         pkill -f main_loop.py   # or: sudo systemctl stop surgealert-edge\n"
                        "         sudo fuser -v /dev/ttyUSB2\n"
                        "         sudo systemctl stop ModemManager   # if ModemManager holds the port"
                    )
                else:
                    print(
                        f" [GSM] CONNECTION FAILED on {self.port}: {e} — "
                        "check USB, antenna, SIM, and ttyUSB mapping (expected GSM on ttyUSB2)."
                    )
                return False
