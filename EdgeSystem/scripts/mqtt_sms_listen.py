#!/usr/bin/env python3
"""Listen for OTP MQTT messages (no GSM). Use to verify backend → Pi broker path."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import MQTT_BROKER, MQTT_PASSWORD, MQTT_PORT, MQTT_USERNAME
from system_main.main_loop import _create_mqtt_client
from system_main.mqtt_sms_bridge import SMS_OUTBOUND_TOPIC, attach_outbound_sms_handler


class _PrintWorker:
    def enqueue_otp(self, number, message):
        print(f" [TEST] Would send OTP to {number}: {message[:80]}...")

    def enqueue(self, number, message):
        print(f" [TEST] Would send alert SMS to {number}: {message[:80]}...")


def main():
    print(f"Listening on {MQTT_BROKER}:{MQTT_PORT} topic {SMS_OUTBOUND_TOPIC}")
    print("Trigger send-otp from the web app, then watch for [SMS] MQTT outbound received here.")
    client = _create_mqtt_client(client_id="SurgeAlertSmsListenTest")
    attach_outbound_sms_handler(client, _PrintWorker())
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
