import cv2
import time
import numpy as np
from config.settings import IMAGE_WIDTH, IMAGE_HEIGHT, CAMERA_INDEX

class PiCameraDriver:
    def __init__(self):
        print(f"Initializing Camera (Index {CAMERA_INDEX})...")
        # Standard VideoCapture for Windows/Mac compatibility
        self.cap = cv2.VideoCapture(CAMERA_INDEX)
            
        if not self.cap.isOpened():
            print(f"ERROR: Could not open Hardware Camera (Index {CAMERA_INDEX}). Please check physical connection.")
            raise RuntimeError("Camera initialization failed.")
            
        # Set Resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMAGE_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMAGE_HEIGHT)
        
        time.sleep(1)
        print("Hardware Camera Initialized Successfully.")

    def capture_frame(self):
        # Try up to 3 times to handle transient 'select() timeout' on Raspberry Pi
        for i in range(3):
            ret, frame = self.cap.read()
            if ret:
                return frame
            print(f" [Hardware] Warning: Camera read failed (Attempt {i+1}/3).")
            time.sleep(0.2)
            
        # If all retries fail, return a blank black frame so the system doesn't crash
        return np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), np.uint8)

    def close(self):
        if self.cap.isOpened():
            self.cap.release()
            print("Camera released.")