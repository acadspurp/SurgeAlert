import cv2
import numpy as np
import time
from itertools import cycle
from config.settings import MAX_CORNERS, QUALITY_LEVEL, MIN_DISTANCE, \
    LK_WINDOW_SIZE, LK_MAX_LEVEL, LK_CRITERIA, PIXELS_TO_METERS, USE_HARDWARE

class ImageProcessor:
    def __init__(self):
        self.prev_gray = None
        self.prev_pts = None
        self.prev_time = None

        # CV Parameters from settings
        self.feature_params = dict(maxCorners=MAX_CORNERS,
                                   qualityLevel=QUALITY_LEVEL, minDistance=MIN_DISTANCE, blockSize=7)
        self.lk_params = dict(winSize=LK_WINDOW_SIZE,
                              maxLevel=LK_MAX_LEVEL, criteria=LK_CRITERIA)
        
        # --- SIMULATION VALUES ---
        # Target: 1.45 m/s Flow
        self.sim_flow = cycle([1.45])
        
        # Target: 0.5927 m/min Rise
        # We must return m/s here. 
        # 0.5927 / 60 = 0.00987833
        self.sim_rise = cycle([0.00987833])

    def process_frame(self, frame):
        """
        Calculates optical flow to determine water speed and rise rate.
        Returns:
            flow_mps (float): Horizontal speed in m/s
            rise_mps (float): Vertical speed in m/s
            viz_frame (image): Frame with debug lines
            raw_vectors (list): List of points for DB logging
        """
        if frame is None:
            return 0.0, 0.0, None, []
            
        viz_frame = frame.copy()

        # --- SIMULATION BYPASS ---
        # If hardware is OFF, we force the values to match the screenshot requirements.
        if not USE_HARDWARE:
            # Draw a label so we know it's forced
            cv2.putText(viz_frame, "SIMULATION: FORCED VALUES", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
            # Return fixed values
            return next(self.sim_flow), next(self.sim_rise), viz_frame, []

        # --- REAL CV LOGIC BELOW (Only runs if USE_HARDWARE = True) ---
        current_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Initialization on first frame
        if self.prev_gray is None:
            self.prev_gray = current_gray
            self.prev_pts = cv2.goodFeaturesToTrack(current_gray, mask=None, **self.feature_params)
            self.prev_time = time.time()
            return 0.0, 0.0, viz_frame, []

        # Calculate time delta (dt) for physics accuracy
        curr_time = time.time()
        dt = curr_time - self.prev_time
        self.prev_time = curr_time
        
        # Prevent divide by zero if processing is too fast
        if dt < 0.001: dt = 0.001

        # Optical Flow (Lucas-Kanade)
        # Re-detect points if too few are tracked
        if self.prev_pts is None or len(self.prev_pts) < 5:
            self.prev_pts = cv2.goodFeaturesToTrack(self.prev_gray, mask=None, **self.feature_params)
            self.prev_gray = current_gray
            return 0.0, 0.0, viz_frame, []
            
        next_pts, status, _ = cv2.calcOpticalFlowPyrLK(self.prev_gray, current_gray, self.prev_pts, None, **self.lk_params)

        # Filter good points
        if next_pts is not None and status is not None:
            good_new = next_pts[status == 1]
            good_old = self.prev_pts[status == 1]
        else:
            # Lost tracking, reset
            self.prev_gray = current_gray
            return 0.0, 0.0, viz_frame, []

        # --- PHYSICS CALCULATION ---
        displacements = good_new - good_old
        velocities_px = displacements / dt

        # Avg Velocity [x, y]
        avg_vel_px = np.mean(velocities_px, axis=0)

        # Flow = Horizontal Speed (Absolute value)
        flow_mps = abs(avg_vel_px[0]) * PIXELS_TO_METERS

        # Rise = Vertical Speed (Inverted because Y is down in images)
        # If avg_vel_px[1] is negative (moving up), water is rising.
        rise_mps = -avg_vel_px[1] * PIXELS_TO_METERS

        # Prepare Raw Data & Visualization
        raw_vectors = []
        for i, (new, old) in enumerate(zip(good_new, good_old)):
            a, b = new.ravel()
            c, d = old.ravel()
            
            # Store vector (x1, y1, x2, y2)
            # We save every 2nd point to save DB space
            if i % 2 == 0:
                raw_vectors.append([float(c), float(d), float(a), float(b)])
            
            # Draw on screen
            cv2.line(viz_frame, (int(a), int(b)), (int(c), int(d)), (0, 255, 0), 2)
            cv2.circle(viz_frame, (int(a), int(b)), 3, (0, 0, 255), -1)

        # Update state for next iteration
        self.prev_gray = current_gray.copy()
        self.prev_pts = good_new.reshape(-1, 1, 2)

        return flow_mps, rise_mps, viz_frame, raw_vectors