#!/usr/bin/env python3
"""Send one test SMS via SIM7600 on the Pi. Run from EdgeSystem with venv active."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config.settings import GSM_PORT, GSM_BAUDRATE
from system_main.sms_manager import SMSManager


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/test_gsm_sms.py 9XXXXXXXXX [optional message]")
        print("Example: python3 scripts/test_gsm_sms.py 9123456789")
        sys.exit(1)
    phone = sys.argv[1]
    body = sys.argv[2] if len(sys.argv) > 2 else "SurgeAlert GSM test — ignore if received."
    sms = SMSManager(port=GSM_PORT, baudrate=GSM_BAUDRATE)
    ok = sms.send_gsm_only(phone, body)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
