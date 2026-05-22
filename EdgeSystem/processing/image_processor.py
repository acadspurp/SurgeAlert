import cv2
import numpy as np
import time
from config.settings import (
    CV_MIN_DIST_TO_WATER_M,
    LK_CRITERIA,
    LK_MAX_LEVEL,
    LK_WINDOW_SIZE,
    MAX_CORNERS,
    MIN_DISTANCE,
    PIXELS_TO_METERS,
    QUALITY_LEVEL,
    SENSOR_HEIGHT_FROM_MUDPLAIN,
)

class ImageProcessor:
    def __init__(self):
        self.prev_gray = None
        self.prev_pts = None
        self.prev_time = None

        # CV Parameters from settings
        self.feature_params = dict(maxCorners=MAX_CORNERS,
                                   qualityLevel=QUALITY_LEVEL, 
                                   minDistance=MIN_DISTANCE, 
                                   blockSize=7)
        self.lk_params = dict(winSize=LK_WINDOW_SIZE,
                              maxLevel=LK_MAX_LEVEL, 
                              criteria=LK_CRITERIA)

    def process_frame(self, frame, water_level=0.0):
        """
        Calculates real optical flow using dynamic scaling based on water level.
        Returns: flow_mps, rise_mps, viz_frame, raw_vectors
        """
        if frame is None:
            return 0.0, 0.0, None, []
            
        viz_frame = frame.copy()
        current_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Initialization on first frame
        if self.prev_gray is None:
            self.prev_gray = current_gray
            self.prev_pts = cv2.goodFeaturesToTrack(current_gray, mask=None, **self.feature_params)
            self.prev_time = time.time()
            return 0.0, 0.0, viz_frame, []

        curr_time = time.time()
        dt = curr_time - self.prev_time
        self.prev_time = curr_time
        
        if dt < 0.001: dt = 0.001

        # Lucas-Kanade Optical Flow
        if self.prev_pts is None or len(self.prev_pts) < 5:
            self.prev_pts = cv2.goodFeaturesToTrack(self.prev_gray, mask=None, **self.feature_params)
            self.prev_gray = current_gray
            return 0.0, 0.0, viz_frame, []
            
        next_pts, status, _ = cv2.calcOpticalFlowPyrLK(self.prev_gray, current_gray, self.prev_pts, None, **self.lk_params)

        if next_pts is not None and status is not None:
            good_new = next_pts[status == 1]
            good_old = self.prev_pts[status == 1]
            if len(good_new) == 0 or len(good_old) == 0:
                self.prev_gray = current_gray
                self.prev_pts = None
                return 0.0, 0.0, viz_frame, []
        else:
            self.prev_gray = current_gray
            return 0.0, 0.0, viz_frame, []

        # --- PHYSICS CALCULATION ---
        displacements = good_new - good_old
        velocities_px = displacements / dt
        avg_vel_px = np.mean(velocities_px, axis=0)

        # Result Conversion (Dynamic Scale based on water level)
        # Higher water = closer to camera = more pixels per meter
        # We assume PIXELS_TO_METERS is calibrated at mudplain (water_level=0)
        dist_to_water = max(
            CV_MIN_DIST_TO_WATER_M, SENSOR_HEIGHT_FROM_MUDPLAIN - water_level
        )
        
        # Adjust scale: factor decreases as water rises (closer objects look bigger/faster)
        dynamic_scale = PIXELS_TO_METERS * (dist_to_water / SENSOR_HEIGHT_FROM_MUDPLAIN)

        flow_mps = abs(avg_vel_px[0]) * dynamic_scale
        rise_mps = -avg_vel_px[1] * dynamic_scale

        raw_vectors = []
        for i, (new, old) in enumerate(zip(good_new, good_old)):
            a, b = new.ravel()
            c, d = old.ravel()
            if i % 2 == 0:
                raw_vectors.append([float(c), float(d), float(a), float(b)])
            
            cv2.line(viz_frame, (int(a), int(b)), (int(c), int(d)), (0, 255, 0), 2)
            cv2.circle(viz_frame, (int(a), int(b)), 3, (0, 0, 255), -1)

        self.prev_gray = current_gray.copy()
        self.prev_pts = good_new.reshape(-1, 1, 2)

        return flow_mps, rise_mps, viz_frame, raw_vectors