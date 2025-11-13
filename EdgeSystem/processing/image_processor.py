# EdgeSystem/processing/image_processor.py
import cv2
import numpy as np
from config.settings import (
    IMAGE_WIDTH, IMAGE_HEIGHT, MAX_CORNERS, QUALITY_LEVEL, MIN_DISTANCE,
    LK_WINDOW_SIZE, LK_MAX_LEVEL, LK_CRITERIA
)

class ImageProcessor:
    """Handles all computer vision tasks."""
    def __init__(self):
        print("Initialized Image Processor.")
        self.shi_tomasi_params = dict(
            maxCorners=MAX_CORNERS,
            qualityLevel=QUALITY_LEVEL,
            minDistance=MIN_DISTANCE,
            blockSize=7
        )
        self.lucas_kanade_params = dict(
            winSize=LK_WINDOW_SIZE,
            maxLevel=LK_MAX_LEVEL,
            criteria=LK_CRITERIA
        )
        # State for optical flow
        self.previous_frame_gray = None
        self.previous_points = None

    def process_frame(self, frame):
        """
        Processes a single frame to calculate flow and rise rates.
        Returns: (image_flow_rate_mps, image_rise_rate_mps)
        """
        if frame is None:
            return 0.0, 0.0

        current_frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # For the first frame, we only detect features and set the state
        if self.previous_frame_gray is None:
            self.previous_frame_gray = current_frame_gray
            self.previous_points = cv2.goodFeaturesToTrack(
                self.previous_frame_gray, mask=None, **self.shi_tomasi_params
            )
            return 0.0, 0.0

        # If we don't have any points to track from the last frame, find them again
        if self.previous_points is None or len(self.previous_points) < 5:
             self.previous_points = cv2.goodFeaturesToTrack(
                self.previous_frame_gray, mask=None, **self.shi_tomasi_params
            )
             # If still no points, can't do anything
             if self.previous_points is None:
                 self.previous_frame_gray = current_frame_gray
                 return 0.0, 0.0


        # Calculate optical flow
        new_points, status, error = cv2.calcOpticalFlowPyrLK(
            self.previous_frame_gray,
            current_frame_gray,
            self.previous_points,
            None,
            **self.lucas_kanade_params
        )

        # Select good points
        if new_points is not None and status is not None:
            good_new = new_points[status == 1]
            good_old = self.previous_points[status == 1]
        else:
            # If tracking fails, reset and wait for the next frame
            self.previous_frame_gray = current_frame_gray
            self.previous_points = None
            return 0.0, 0.0

        # Calculate the average movement vector
        if len(good_new) > 0:
            # Assuming 30 FPS, change if different. DT is time delta.
            # This is a simplification. A more robust solution would measure actual time.
            DT = 1/30
            velocities = (good_new - good_old) / DT # pixels per second
            avg_velocity = np.mean(velocities, axis=0)
            
            # Simple conversion: 1 pixel movement = X meters. This is a GUESS.
            # This 'pixels_to_meters' ratio needs calibration with the real hardware setup.
            PIXELS_TO_METERS = 0.01 
            
            flow_rate_mps = abs(avg_velocity[0]) * PIXELS_TO_METERS
            rise_rate_mps = -avg_velocity[1] * PIXELS_TO_METERS # Y is inverted in images
        else:
            flow_rate_mps = 0.0
            rise_rate_mps = 0.0

        # Update the state for the next frame
        self.previous_frame_gray = current_frame_gray
        self.previous_points = good_new.reshape(-1, 1, 2)

        return round(flow_rate_mps, 2), round(rise_rate_mps, 2)

# --- How to Test This Module ---
if __name__ == '__main__':
    from simulation.camera.camera_simulator import CameraSimulator
    
    print("Testing Image Processor...")
    processor = ImageProcessor()
    cam_sim = CameraSimulator()
    frame_generator = cam_sim.get_frame_sequence()

    for i in range(10):
        frame = next(frame_generator)
        flow, rise = processor.process_frame(frame)
        print(f"Frame {i+1}: Flow Rate = {flow} m/s, Rise Rate = {rise} m/s")
