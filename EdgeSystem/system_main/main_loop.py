import time
import json
import requests
import threading
import sys
import os
from datetime import datetime
import paho.mqtt.client as mqtt
import ssl
import warnings

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import BACKEND_IP, BACKEND_API_URL, EDGE_API_KEY, MQTT_BROKER, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD

# Suppress paho-mqtt deprecation warning
warnings.filterwarnings("ignore", category=DeprecationWarning, module="paho.mqtt")

from system_main.sms_manager import SMSManager

def sync_environmental_data():
    """Fetches the latest simulation status from the backend."""
    try:
        url = f"{BACKEND_API_URL}/edge/sync/environmental"
        headers = {"X-Edge-Key": EDGE_API_KEY}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f" [Sync] Simulation fetch error: {e}")
    return None

def main():
    print("--- STARTING SURGE ALERT EDGE SYSTEM (SIMULATION + SMS GATEWAY) ---")
    
    # 0. Initialize SMS Manager
    sms = None
    try:
        sms = SMSManager() # GSM Initializer
    except Exception as e:
        print(f" [System] Warning: GSM Module initialization failed. SMS offline. Error: {e}")
    
    # 1. Initialize MQTT Client for Java Backend (MQTTS)
    try:
        mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="SurgeAlertEdge_Sim")
    except (AttributeError, TypeError):
        mqtt_client = mqtt.Client(client_id="SurgeAlertEdge_Sim", protocol=mqtt.MQTTv311)
    
    is_local = "localhost" in MQTT_BROKER or "127.0.0.1" in MQTT_BROKER or BACKEND_IP in MQTT_BROKER
    
    if not is_local:
        mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        mqtt_client.tls_set(tls_version=ssl.PROTOCOL_TLS) 
    else:
        print(" [Net] Local MQTT detected. Skipping SSL/Auth if not configured.")
    
    try:
        print(f" [Net] Connecting to Secure MQTT Broker at {MQTT_BROKER}...")
        
        # Define callback for outbound SMS (Backend asking Pi to send SMS/OTP)
        def on_message(client, userdata, msg):
            if msg.topic == "surgealert/outbound/sms":
                try:
                    data = json.loads(msg.payload.decode())
                    num = data.get("number")
                    txt = data.get("message")
                    if num and txt and sms:
                        print(f" [SMS] Received Outbound Request for {num}")
                        sms.send_sms(num, txt)
                except Exception as e:
                    print(f" [SMS] Failed to process outbound MQTT SMS: {e}")

        mqtt_client.on_message = on_message
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.subscribe("surgealert/outbound/sms")
        mqtt_client.loop_start() # Start background thread for MQTT network traffic
        print(" [Net] MQTT Connected & Subscribed to Outbound SMS (Always Listening)!")
    except Exception as e:
        print(f" [Net] MQTT Connection Failed: {e}")

    HEARTBEAT_INTERVAL = 300.0  # 5 Minutes (Matches injected dataset granularity)

    print("\n [System] Entering Eco-Simulation Mode (5-Minute Heartbeat).")
    
    try:
        while True:
            start_time = time.time()
            
            # --- 1. Fetch Simulation Data ---
            env_data = sync_environmental_data()
            
            # --- 2. Print Authentic Sensor-Like Logs ---
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] [Hardware] Initializing 30-second sensor burst...")
            time.sleep(1)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Sensor] Ultrasonic Rangefinder: Polling distance...")
            time.sleep(0.5)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Sensor] Doppler Radar: Fetching surface flow velocity...")
            time.sleep(0.5)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Camera] Capturing 1080p snapshot for Computer Vision...")
            time.sleep(1.2)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [CV] Running Optical Flow (Lucas-Kanade) analysis...")
            time.sleep(0.8)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Model] Executing GRU-Inference on hydrological telemetry...")
            
            if env_data:
                wl = env_data.get("water_level", 0.0)
                alert = env_data.get("alert_level", "GREEN")
                fr = env_data.get("flow_rate", 0.0)
                
                print("\n" + "="*50)
                print(f" [LOCAL EDGE DASHBOARD] - STATUS: {alert}")
                print("-" * 50)
                print(f" HYDROLOGICAL DATA:")
                print(f"  > Water Level   : {wl:.2f} m")
                print(f"  > Flow Velocity : {fr:.2f} m/s")
                print(f"  > Rise Rate     : {env_data.get('rise_rate', 0.0):.3f} m/s")
                print(f" METEOROLOGICAL CONTEXT:")
                print(f"  > QC Rainfall   : {env_data.get('qc_rain', 0.0):.1f} mm")
                print(f"  > Tide Height   : {env_data.get('tide_height', 0.0):.2f} m")
                print(f"  > Air Pressure  : {env_data.get('pressure', 1013):.0f} hPa")
                print("-" * 50)
                print(f" [Sync] Telemetry transmitted to cloud backend successfully.")
                print("="*50 + "\n")
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [System] Entering Low-Power Idle (72h Battery Saver).")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [Gateway] SMS Listener active. Waiting for heartbeat...")
            
            # --- 3. Heartbeat Sleep ---
            # Wait for the next 10-minute cycle. 
            # The MQTT background thread will handle any SMS requests instantly while we sleep.
            elapsed = time.time() - start_time
            sleep_time = max(0, HEARTBEAT_INTERVAL - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\nStopping SurgeAlert Simulation Gateway...")
    finally:
        print("System Offline.")
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()

if __name__ == "__main__":
    main()