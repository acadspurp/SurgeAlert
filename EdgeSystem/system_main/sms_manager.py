import serial
import time
import threading

from system_main.phone_utils import normalize_ph_mobile, format_for_gsm


class SMSManager:
    _lock = threading.Lock()

    def __init__(self, port="/dev/ttyUSB2", baudrate=115200):
        self.port = port
        self.baudrate = baudrate
        print(f" [GSM] Configured SIM7600 on {self.port} @ {self.baudrate}.")

    def send_gsm_only(self, phone_number, message):
        """Send via SIM7600 only (backend MQTT fallback and offline alerts)."""
        ten = normalize_ph_mobile(phone_number)
        if not ten:
            print(f" [GSM] CONFIG: invalid phone number for GSM: {phone_number}")
            return False
        dial = format_for_gsm(ten)
        return self._send_via_gsm(dial, message)

    def _send_via_gsm(self, dial_number, message):
        with self._lock:
            try:
                print(f" [GSM] Sending to {dial_number} via {self.port}...")
                ser = serial.Serial(self.port, self.baudrate, timeout=3)

                ser.reset_input_buffer()
                ser.write(b"AT\r")
                time.sleep(0.5)

                ser.write(b"AT+CMGF=1\r")
                time.sleep(0.5)

                ser.write(f'AT+CMGS="{dial_number}"\r'.encode())

                start_time = time.time()
                prompt_received = False
                while time.time() - start_time < 5:
                    if ser.in_waiting > 0:
                        line = ser.read_all().decode(errors="ignore")
                        if ">" in line:
                            prompt_received = True
                            break
                    time.sleep(0.1)

                if not prompt_received:
                    print(
                        f" [GSM] HARDWARE: no CMGS prompt on {self.port} — "
                        "SIM not ready, wrong port, or module not in SMS mode."
                    )
                    ser.close()
                    return False

                ser.write(f"{message}\x1A".encode())
                time.sleep(5)

                response = ser.read_all().decode(errors="ignore")
                ser.close()

                if "OK" in response or "+CMGS:" in response:
                    print(f" [GSM] OK: message accepted by module for {dial_number}.")
                    return True
                print(f" [GSM] HARDWARE: send failed. Module response: {response!r}")
                return False

            except Exception as e:
                print(
                    f" [GSM] CONNECTION FAILED on {self.port}: {e} — "
                    "check USB, antenna, SIM, and ttyUSB mapping (expected GSM on ttyUSB2)."
                )
                return False
