import time

import cv2
import numpy as np

from config.settings import CAMERA_INDEX, IMAGE_HEIGHT, IMAGE_WIDTH


class PiCameraDriver:
    def __init__(self):
        print(f" [Camera] Opening device index {CAMERA_INDEX} ({IMAGE_WIDTH}x{IMAGE_HEIGHT})...")
        self.cap = cv2.VideoCapture(CAMERA_INDEX)

        if not self.cap.isOpened():
            print(
                f" [Camera] CONNECTION FAILED: cannot open index {CAMERA_INDEX} — "
                "check USB/cable, enable camera, or try libcamera-v4l2 on Pi."
            )
            raise RuntimeError("Camera initialization failed.")

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, IMAGE_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, IMAGE_HEIGHT)
        time.sleep(1)
        print(" [Camera] OK: capture device ready.")

    def capture_frame(self):
        for attempt in range(3):
            ret, frame = self.cap.read()
            if ret:
                return frame
            print(
                f" [Camera] HARDWARE: read failed ({attempt + 1}/3) — "
                "select() timeout or busy device; retrying."
            )
            time.sleep(0.2)

        print(
            " [Camera] HARDWARE: all read attempts failed — using blank frame for this sample."
        )
        return np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), np.uint8)

    def close(self):
        if self.cap.isOpened():
            self.cap.release()
            print(" [Camera] Released.")
