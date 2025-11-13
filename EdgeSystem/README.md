# SurgeAlert - EdgeSystem

This repository contains the Python-based on-site data collection and processing unit for the SurgeAlert Flood Monitoring and Early Warning System. This system is designed to run on a low-power edge device, such as a Raspberry Pi, deployed at the Tullahan River.

---

## Core Features

- **Real-time Data Collection**: Gathers water level and flow data from sensors.
- **Computer Vision Analysis**: Captures and analyzes live video to calculate water flow and rise rate using Shi-Tomasi and Lucas-Kanade optical flow algorithms.
- **Automated Alerting**: Determines the current flood alert level (Green, Yellow, Orange, Red) based on predefined rules.
- **SMS Notifications**: Automatically disseminates critical alerts to registered residents via SMS.
- **Local Data Logging**: Stores all sensor readings and alert history in a local SQLite database for future analysis and ML model training.
- **Web App Integration**: Sends real-time status updates to the central `SurgeAlertWebApp` for public display.

---

## Technology Stack

- **Language**: Python 3
- **Core Libraries**:
  - OpenCV
  - NumPy
  - Requests
  - (Future: Scikit-learn, Pandas)
- **Database**: SQLite 3

---

## Setup and Installation

1.  **Prerequisites**:
    - Python 3.8+
    - `pip` package installer
    - Git

2.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    ```

3.  **Navigate to Directory**:
    ```bash
    cd EdgeSystem
    ```

4.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

5.  **Setup Sample Images for Simulation**:
    - Place a sample image of the river named `sample_water.jpg` inside `simulation/camera/sample_images/`.
    - For optical flow testing, create a subfolder `river_sequence/` in the same directory and populate it with a sequence of images (e.g., frames from a video).

---

## How to Run

The system can be run in two modes, controlled by the `USE_HARDWARE` flag in `config/settings.py`.

### Running in Simulation Mode

This mode is for development and testing without physical hardware.

1.  Ensure `USE_HARDWARE = False` in `config/settings.py`.
2.  Run the main application from the `EdgeSystem` root directory:
    ```bash
    python -m system_main.main_loop
    ```
3.  An OpenCV window will show the simulated video feed with tracking points. The console will display real-time data and alerts.
4.  Press `Ctrl+C` in the terminal to stop the system.

### Running in Hardware Mode

This mode is for deployment on the Raspberry Pi with sensors connected.

1.  Complete the driver code in the `hardware/` directory for your specific sensors.
2.  Set `USE_HARDWARE = True` in `config/settings.py`.
3.  Run the main application: `python -m system_main.main_loop`.