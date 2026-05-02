# EdgeSystem/processing/image_processor.py
import cv2
import numpy as np
from config.settings import (
    IMAGE_WIDTH, IMAGE_HEIGHT, MAX_CORNERS, QUALITY_LEVEL, MIN_DISTANCE,
    LK_WINDOW_SIZE, LK_MAX_LEVEL, LK_CRITERIA, PIXELS_TO_METERS
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
        Returns: (flow_rate_mps, rise_rate_mps, visualized_frame)
        """
        if frame is None:
            return 0.0, 0.0, None

        current_frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Create a copy of the frame to draw on
        visualized_frame = frame.copy()

        # For the first frame, we only detect features and set the state
        if self.previous_frame_gray is None:
            self.previous_frame_gray = current_frame_gray
            self.previous_points = cv2.goodFeaturesToTrack(
                self.previous_frame_gray, mask=None, **self.shi_tomasi_params
            )
            return 0.0, 0.0, visualized_frame

        # If we don't have any points to track, find them again
        if self.previous_points is None or len(self.previous_points) < 5:
             self.previous_points = cv2.goodFeaturesToTrack(
                self.previous_frame_gray, mask=None, **self.shi_tomasi_params
            )
             if self.previous_points is None:
                 self.previous_frame_gray = current_frame_gray
                 return 0.0, 0.0, visualized_frame

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
            self.previous_frame_gray = current_frame_gray
            self.previous_points = None
            return 0.0, 0.0, visualized_frame

        # Calculate movement and Draw Visualization
        if len(good_new) > 0:
            DT = 1/30 # Assuming 30 FPS
            velocities = (good_new - good_old) / DT 
            avg_velocity = np.mean(velocities, axis=0)
            
            # Draw tracks
            for i, (new, old) in enumerate(zip(good_new, good_old)):
                a, b = new.ravel()
                c, d = old.ravel()
                # Draw the movement line (Green)
                visualized_frame = cv2.line(visualized_frame, (int(a), int(b)), (int(c), int(d)), (0, 255, 0), 2)
                # Draw the current point (Red)
                visualized_frame = cv2.circle(visualized_frame, (int(a), int(b)), 3, (0, 0, 255), -1)

            # Use the constant imported from settings.py
            flow_rate_mps = abs(avg_velocity[0]) * PIXELS_TO_METERS
            rise_rate_mps = -avg_velocity[1] * PIXELS_TO_METERS 
        else:
            flow_rate_mps = 0.0
            rise_rate_mps = 0.0

        # Update the state for the next frame
        self.previous_frame_gray = current_frame_gray
        self.previous_points = good_new.reshape(-1, 1, 2)

        return round(flow_rate_mps, 2), round(rise_rate_mps, 2), visualized_frame