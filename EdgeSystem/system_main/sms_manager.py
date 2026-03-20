import serial
import time

class SMSManager:
    # If using USB, the AT command port is usually ttyUSB2 (sometimes ttyUSB3).
    # If using GPIO TX/RX pins, change this to "/dev/serial0"
    def __init__(self, port="/dev/ttyUSB2", baudrate=115200):
        self.port = port
        self.baudrate = baudrate

    def send_sms(self, phone_number, message):
        """Sends an SMS using AT commands to the SIM7600."""
        try:
            print(f" [SMS] Connecting to SIM7600 on {self.port}...")
            ser = serial.Serial(self.port, self.baudrate, timeout=2)
            
            # 1. Test connection
            ser.write(b'AT\r')
            time.sleep(0.5)
            
            # 2. Set SMS mode to Text Mode
            ser.write(b'AT+CMGF=1\r')
            time.sleep(0.5)
            
            # 3. Enter recipient phone number
            ser.write(f'AT+CMGS="{phone_number}"\r'.encode())
            time.sleep(0.5)
            
            # 4. Enter the message and send the CTRL+Z command (ASCII 26) to execute
            ser.write(f'{message}\x1A'.encode())
            time.sleep(3) # Wait a few seconds for network transmission
            
            response = ser.read_all().decode()
            ser.close()
            
            if "OK" in response:
                print(f" [SMS] Successfully sent alert to {phone_number}")
                return True
            else:
                print(f" [SMS] Failed. Response: {response}")
                return False
                
        except Exception as e:
            print(f" [SMS] Hardware Error: {e}")
            return False