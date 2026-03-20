import cv2
import time
from config.settings import IMAGE_WIDTH, IMAGE_HEIGHT, CAMERA_INDEX

class PiCameraDriver:
    def __init__(self):
        print(f"Initializing Camera (Index {CAMERA_INDEX})...")
        # Standard VideoCapture for Windows/Mac compatibility
        self.cap = cv2.VideoCapture(CAMERA_INDEX)
            
        if not self.cap.isOpened():
            print("ERROR: Could not open laptop camera. Try changing CAMERA_INDEX to 1 in settings.")
            raise RuntimeError("Camera initialization failed.")
            
        # Set Resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMAGE_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMAGE_HEIGHT)
        
        time.sleep(1)
        print("Camera Initialized Successfully (Laptop Mode).")

    def capture_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            # If the camera fails, return a blank black frame so the system doesn't crash
            return np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), np.uint8)
        return frame

    def close(self):
        if self.cap.isOpened():
            self.cap.release()
            print("Camera released.")