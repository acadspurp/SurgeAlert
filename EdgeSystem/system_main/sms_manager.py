import serial
import time
import threading

from system_main.phone_utils import normalize_ph_mobile, format_for_gsm, format_for_gsm_intl

# GSM single-SMS limit (7-bit); longer text causes +CMS ERROR: SMS size more than expected
GSM_SMS_MAX_CHARS = 160

# SIM7600 needs idle time between back-to-back CMGS on one serial port
INTER_SMS_COOLDOWN_SEC = 12.0
INTER_OTP_COOLDOWN_SEC = 3.0


def _truncate_gsm_message(message):
    text = (message or "").strip()
    if len(text) <= GSM_SMS_MAX_CHARS:
        return text
    return text[: GSM_SMS_MAX_CHARS - 3].rstrip() + "..."


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
        text = _truncate_gsm_message(message)
        if not text:
            print(" [GSM] CONFIG: empty message")
            return False
        for dial in (format_for_gsm(ten), format_for_gsm_intl(ten)):
            if dial and self._send_via_gsm(dial, text, fast=fast):
                return True
        return False

    def cooldown_after_send(self, *, fast=False):
        """Pause so the next queued SMS does not hit a busy module."""
        time.sleep(INTER_OTP_COOLDOWN_SEC if fast else INTER_SMS_COOLDOWN_SEC)

    def wait_until_ready(self, attempts=6, pause_sec=2.0):
        """Poll AT until the module answers OK (call between queued sends)."""
        with self._lock:
            return self._probe_at_ready(attempts=attempts, pause_sec=pause_sec)

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

    def _probe_at_ready(self, ser=None, attempts=5, pause_sec=1.5):
        own_serial = ser is None
        try:
            if own_serial:
                ser = serial.Serial(self.port, self.baudrate, timeout=2)
            for attempt in range(1, attempts + 1):
                ser.reset_input_buffer()
                ser.write(b"AT\r")
                time.sleep(0.5)
                resp = ser.read_all().decode(errors="ignore")
                if "OK" in resp:
                    return True
                if attempt < attempts:
                    time.sleep(pause_sec)
            return False
        except Exception:
            return False
        finally:
            if own_serial and ser is not None:
                try:
                    ser.close()
                except Exception:
                    pass

    @staticmethod
    def _response_indicates_success(response):
        text = (response or "").upper()
        if "ERROR" in text and "+CMGS:" not in response:
            return False
        return "OK" in text or "+CMGS:" in text

    def _read_modem_buffer(self, ser, max_wait, poll=0.15):
        """Accumulate UART data until CMGS/ERROR or timeout (module can be slow)."""
        buf = ""
        end = time.time() + max_wait
        while time.time() < end:
            waiting = ser.in_waiting
            if waiting > 0:
                buf += ser.read(waiting).decode(errors="ignore")
                upper = buf.upper()
                if "+CMGS:" in buf or ("ERROR" in upper and "OK" not in upper[-20:]):
                    break
            time.sleep(poll)
        if ser.in_waiting > 0:
            buf += ser.read(ser.in_waiting).decode(errors="ignore")
        return buf

    def _send_via_gsm(self, dial_number, message, *, fast=False):
        at_wait = 0.2 if fast else 0.35
        prompt_timeout = 8.0 if fast else 12.0
        cmgs_finish_timeout = 20.0 if fast else 35.0

        with self._lock:
            ser = None
            try:
                print(f" [GSM] Sending to {dial_number} via {self.port}...")
                ser = serial.Serial(self.port, self.baudrate, timeout=3)

                if not self._probe_at_ready(ser, attempts=6, pause_sec=2.0):
                    print(f" [GSM] HARDWARE: no AT OK on {self.port} (module busy or port in use)")
                    return False

                def _at(cmd, wait=None):
                    w = at_wait if wait is None else wait
                    ser.reset_input_buffer()
                    ser.write(cmd if isinstance(cmd, bytes) else cmd.encode())
                    time.sleep(w)
                    return ser.read_all().decode(errors="ignore")

                _at(b"ATE0\r")
                _at(b'AT+CSCS="GSM"\r')
                _at(b"AT+CMGF=1\r")

                ser.reset_input_buffer()
                ser.write(f'AT+CMGS="{dial_number}"\r'.encode())

                prompt_buf = ""
                start = time.time()
                while time.time() - start < prompt_timeout:
                    if ser.in_waiting > 0:
                        prompt_buf += ser.read(ser.in_waiting).decode(errors="ignore")
                        if ">" in prompt_buf:
                            break
                    time.sleep(0.08)

                if ">" not in prompt_buf:
                    print(
                        f" [GSM] HARDWARE: no CMGS prompt for {dial_number} on {self.port} — "
                        "SIM not ready, wrong port, or module busy."
                    )
                    self._try_abort_cmgs(ser)
                    return False

                ser.write(f"{message}\x1A".encode("ascii", errors="replace"))
                response = self._read_modem_buffer(ser, cmgs_finish_timeout)

                if not self._response_indicates_success(response):
                    # Extra window: first SMS often completes after an empty first read
                    response += self._read_modem_buffer(ser, 10.0 if fast else 15.0)

                if self._response_indicates_success(response):
                    print(f" [GSM] OK: message accepted by module for {dial_number}.")
                    self._wait_until_idle(ser, fast=fast)
                    return True

                if "ERROR" in (response or "").upper():
                    print(f" [GSM] HARDWARE: module ERROR for {dial_number}: {response!r}")
                else:
                    print(f" [GSM] HARDWARE: send failed for {dial_number}: {response!r}")

                self._try_abort_cmgs(ser)
                return False

            except Exception as e:
                err = str(e)
                if "busy" in err.lower() or getattr(e, "errno", None) == 16:
                    print(
                        f" [GSM] PORT BUSY on {self.port}: {e}\n"
                        "       Stop other programs using this port first:\n"
                        "         pkill -f main_loop.py   # or: sudo systemctl stop surgealert-edge\n"
                        "         sudo fuser -v /dev/ttyUSB2\n"
                        "         sudo systemctl stop ModemManager"
                    )
                else:
                    print(
                        f" [GSM] CONNECTION FAILED on {self.port}: {e} — "
                        "check USB, antenna, SIM, and ttyUSB mapping (expected GSM on ttyUSB2)."
                    )
                return False
            finally:
                if ser is not None:
                    try:
                        ser.close()
                    except Exception:
                        pass

    def _try_abort_cmgs(self, ser):
        try:
            ser.write(b"\x1B")
            time.sleep(0.3)
            ser.reset_input_buffer()
            ser.write(b"AT\r")
            time.sleep(0.5)
            ser.read_all()
        except Exception:
            pass

    def _wait_until_idle(self, ser, *, fast=False):
        """Brief poll until AT OK after a successful CMGS."""
        self._probe_at_ready(ser, attempts=4, pause_sec=1.0 if fast else 1.5)
