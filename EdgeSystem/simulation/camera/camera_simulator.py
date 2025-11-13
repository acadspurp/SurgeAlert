import cv2
import os
from config.settings import SIM_CAMERA_SAMPLE_IMAGE_PATH, SIM_CAMERA_SEQUENCE_PATH, IMAGE_WIDTH, IMAGE_HEIGHT

class CameraSimulator:
    """Simulates a camera capturing single frames and image sequences."""
    def __init__(self):
        print("Initialized Camera Simulator.")
        if not os.path.exists(SIM_CAMERA_SAMPLE_IMAGE_PATH):
            raise FileNotFoundError(f"Sample image not found at {SIM_CAMERA_SAMPLE_IMAGE_PATH}. Please ensure it exists.")

    def capture_single_frame(self):
        """
        Reads and returns the single sample water image.
        """
        frame = cv2.imread(SIM_CAMERA_SAMPLE_IMAGE_PATH)
        if frame is None:
            print(f"Error: Could not read image from {SIM_CAMERA_SAMPLE_IMAGE_PATH}")
            return None
        return cv2.resize(frame, (IMAGE_WIDTH, IMAGE_HEIGHT))

    def get_frame_sequence(self):
        """
        A generator that yields frames from the river_sequence directory.
        Loops indefinitely for continuous simulation.
        """
        if not os.path.isdir(SIM_CAMERA_SEQUENCE_PATH):
            print(f"Warning: Sequence path {SIM_CAMERA_SEQUENCE_PATH} not found. Using single image.")
            while True:
                yield self.capture_single_frame()

        image_files = sorted([os.path.join(SIM_CAMERA_SEQUENCE_PATH, f) for f in os.listdir(SIM_CAMERA_SEQUENCE_PATH) if f.endswith(('.jpg', '.png'))])

        if not image_files:
             print(f"Warning: No images found in {SIM_CAMERA_SEQUENCE_PATH}. Using single image.")
             while True:
                yield self.capture_single_frame()

        print(f"Found {len(image_files)} images for sequence simulation.")
        while True: # Loop forever
            for image_path in image_files:
                frame = cv2.imread(image_path)
                if frame is not None:
                    yield cv2.resize(frame, (IMAGE_WIDTH, IMAGE_HEIGHT))


# --- How to Test This Module ---
if __name__ == '__main__':
    # You MUST have a 'sample_water.jpg' in simulation/camera/sample_images/
    # And for the sequence test, create a 'river_sequence' folder inside sample_images
    # and place a few numbered images inside it (e.g., 01.jpg, 02.jpg, 03.jpg).
    simulator = CameraSimulator()

    # Test single frame capture
    print("\nTesting single frame capture...")
    frame = simulator.capture_single_frame()
    if frame is not None:
        print(f"Successfully captured a frame with shape: {frame.shape}")
        # cv2.imshow("Single Frame", frame)
        # cv2.waitKey(1000) # Show for 1 sec
        # cv2.destroyAllWindows()
    else:
        print("Failed to capture a single frame.")

    # Test frame sequence
    print("\nTesting frame sequence...")
    frame_generator = simulator.get_frame_sequence()
    for i in range(5):
        seq_frame = next(frame_generator)
        if seq_frame is not None:
            print(f"Got sequence frame {i+1} with shape: {seq_frame.shape}")
        else:
            print("Failed to get a sequence frame.")
