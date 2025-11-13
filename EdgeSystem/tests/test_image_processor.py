# EdgeSystem/tests/test_image_processor.py
import numpy as np
from simulation.camera.camera_simulator import CameraSimulator
from processing.image_processor import ImageProcessor

def test_processor_output_types():
    print("Testing image processor output types...")
    sim = CameraSimulator()
    proc = ImageProcessor()
    frame = sim.capture_frame()
    flow, rise, viz_frame = proc.process_frame(frame)
    
    assert isinstance(flow, float)
    assert isinstance(rise, float)
    assert isinstance(viz_frame, np.ndarray)
    print("Image processor output types test PASSED.")

if __name__ == "__main__":
    test_processor_output_types()