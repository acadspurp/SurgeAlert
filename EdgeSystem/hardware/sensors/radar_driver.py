import threading
import time

import serial

from config.settings import (
    RADAR_BAUDRATE,
    RADAR_PORT,
    USE_HARDWARE,
)

_current_speed_mps = 0.0
_running = False
_serial_conn = None
_lines_seen = 0
_parse_count = 0
_last_diag_time = 0.0


def init_radar():
    global _running, _serial_conn, _lines_seen, _parse_count, _last_diag_time
    _lines_seen = 0
    _parse_count = 0
    _last_diag_time = time.time()

    if not USE_HARDWARE:
        print(" [Radar] Simulated mode (USE_HARDWARE=false).")
        return

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            print(f" [Radar] CONNECT TRY {attempt}/{max_attempts} on {RADAR_PORT}...")
            _serial_conn = serial.Serial(RADAR_PORT, RADAR_BAUDRATE, timeout=1)
            _running = True
            threading.Thread(target=_read_serial_loop, daemon=True).start()
            print(f" [Radar] OK: serial open on {RADAR_PORT}.")
            break
        except Exception as e:
            print(f" [Radar] CONNECTION FAILED attempt {attempt}/{max_attempts}: {e} — check USB cable, power, and udev port mapping.")
            if attempt == max_attempts:
                _running = False


def _read_serial_loop():
    global _current_speed_mps, _running, _lines_seen, _parse_count
    while _running and _serial_conn and _serial_conn.is_open:
        try:
            line = _serial_conn.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                continue
            _lines_seen += 1
            if "speed:" in line.lower():
                parts = line.split(":")
                if len(parts) > 1:
                    _current_speed_mps = float(parts[1].strip().split()[0])
                    _parse_count += 1
        except Exception as e:
            print(f" [Radar] SERIAL READ ERROR: {e}")
            time.sleep(0.1)


def _maybe_warn_no_data():
    global _last_diag_time
    if not USE_HARDWARE or not _running:
        return
    now = time.time()
    if now - _last_diag_time < 60:
        return
    _last_diag_time = now
    if _lines_seen == 0:
        print(
            f" [Radar] HARDWARE: port {_serial_conn.port if _serial_conn else RADAR_PORT} open "
            "but no serial lines — check radar power and TX/RX."
        )
    elif _parse_count == 0:
        print(
            " [Radar] PARSER: bytes received but no 'speed:' field parsed — "
            "firmware line format may differ from radar_driver.py."
        )


def get_flow_rate():
    if not USE_HARDWARE or not _running:
        return 0.0
    _maybe_warn_no_data()
    return _current_speed_mps


def close_radar():
    global _running
    _running = False
    if _serial_conn:
        _serial_conn.close()
