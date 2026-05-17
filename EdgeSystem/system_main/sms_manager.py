import serial
import time
import requests

from config.settings import (
    SMS_ONLINE_PRIMARY,
    SEMAPHORE_ENABLED,
    SEMAPHORE_API_KEY,
    SEMAPHORE_API_URL,
    SEMAPHORE_SENDER_NAME,
)

import threading

class SMSManager:
    _lock = threading.Lock() # Class-level lock to prevent concurrent serial access

    # If using USB, the AT command port is usually ttyUSB2 (sometimes ttyUSB3).
    # If using GPIO TX/RX pins, change this to "/dev/serial0"
    def __init__(self, port="/dev/ttyUSB2", baudrate=115200):
        self.port = port
        self.baudrate = baudrate

    def send_sms(self, phone_number, message):
        """Sends an SMS through online service first, then GSM fallback."""
        if SMS_ONLINE_PRIMARY and self._send_via_semaphore(phone_number, message):
            return True
        return self._send_via_gsm(phone_number, message)

    def send_gsm_only(self, phone_number, message):
        """Offline alert path: SIM7600 only (no internet / Semaphore)."""
        return self._send_via_gsm(phone_number, message)

    def _send_via_semaphore(self, phone_number, message):
        if not SEMAPHORE_ENABLED or not SEMAPHORE_API_KEY:
            return False
        try:
            # Semaphore API expects form-data, not JSON body
            response = requests.post(
                SEMAPHORE_API_URL,
                data={
                    "apikey": SEMAPHORE_API_KEY,
                    "number": phone_number,
                    "message": message,
                    "sendername": SEMAPHORE_SENDER_NAME,
                },
                timeout=10,
            )
            if response.status_code == 200:
                print(f" [SMS] Semaphore provider accepted request for {phone_number}.")
                return True
            else:
                print(f" [SMS] Semaphore API Error: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f" [SMS] Semaphore Connection Failed: {e}")
            return False

    def _send_via_gsm(self, phone_number, message):
        """GSM fallback using AT commands to SIM7600 with thread-safety."""
        # Use lock to prevent concurrent serial port access
        with self._lock:
            try:
                print(f" [SMS] Hardware Send Request: {phone_number}")
                ser = serial.Serial(self.port, self.baudrate, timeout=3)
                
                # 1. Clear buffer and test
                ser.reset_input_buffer()
                ser.write(b'AT\r')
                time.sleep(0.5)
                
                # 2. Set SMS mode to Text Mode
                ser.write(b'AT+CMGF=1\r')
                time.sleep(0.5)
                
                # 3. Enter recipient phone number
                ser.write(f'AT+CMGS="{phone_number}"\r'.encode())
                
                # Wait for the prompt "> "
                start_time = time.time()
                prompt_received = False
                while time.time() - start_time < 5:
                    if ser.in_waiting > 0:
                        line = ser.read_all().decode(errors='ignore')
                        if ">" in line:
                            prompt_received = True
                            break
                    time.sleep(0.1)
                
                if not prompt_received:
                    print(" [SMS] GSM Error: Did not receive prompt from module.")
                    ser.close()
                    return False

                # 4. Enter the message and send the CTRL+Z command (ASCII 26)
                ser.write(f'{message}\x1A'.encode())
                
                # Wait for response (can take up to 20 seconds for actual transmission)
                time.sleep(5) 
                
                response = ser.read_all().decode(errors='ignore')
                ser.close()
                
                if "OK" in response or "+CMGS:" in response:
                    print(f" [SMS] Successfully sent alert to {phone_number}.")
                    return True
                else:
                    print(f" [SMS] GSM Transmission Failed. Response: {response}")
                    return False
                    
            except Exception as e:
                print(f" [SMS] Hardware Error: {e}")
                return False