# EdgeSystem/hardware/camera/pi_camera_driver.py
import cv2
import time
from config.settings import IMAGE_WIDTH, IMAGE_HEIGHT, CAMERA_INDEX

class PiCameraDriver:
    def __init__(self):
        print(f"Initializing Camera (Index {CAMERA_INDEX})...")
        # cv2.CAP_V4L2 is often required on Raspberry Pi for better compatibility
        # If it fails on Windows/Mac, remove cv2.CAP_V4L2
        try:
            self.cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_V4L2)
        except:
            self.cap = cv2.VideoCapture(CAMERA_INDEX)
            
        if not self.cap.isOpened():
            print("ERROR: Could not open camera.")
            raise RuntimeError("Camera initialization failed.")
            
        # Set Resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMAGE_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMAGE_HEIGHT)
        
        # Allow camera to warm up
        time.sleep(1)
        print("Camera Initialized Successfully.")

    def capture_frame(self):
        """Captures a single frame from the camera."""
        ret, frame = self.cap.read()
        if not ret:
            print("Error: Failed to grab frame.")
            return None
        return frame

    def close(self):
        """Releases the camera resource."""
        if self.cap.isOpened():
            self.cap.release()
            print("Camera released.")