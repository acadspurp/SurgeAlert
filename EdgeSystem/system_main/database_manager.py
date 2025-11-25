import sqlite3
import os
import json
from datetime import datetime
from config.settings import DATABASE_DIR, DATABASE_PATH

class DatabaseManager:
    def __init__(self):
        # Ensure the database directory exists
        os.makedirs(DATABASE_DIR, exist_ok=True)
        self.database_path = DATABASE_PATH
        self._create_tables()

    def _get_connection(self):
        """Establishes a connection to the SQLite database."""
        return sqlite3.connect(self.database_path)

    def _create_tables(self):
        """Creates necessary tables if they don't exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # 1. Residents Table (For Offline SMS Fail-safe)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS residents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone_number TEXT UNIQUE NOT NULL,
                    registration_date TEXT NOT NULL
                )
            """)

            # 2. Sent Alerts Log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sent_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    alert_level TEXT,
                    message TEXT,
                    recipient_count INTEGER
                )
            """)

            # 3. Sensor Data (UPDATED with predicted_alert_level)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sensor_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    water_level_m REAL,
                    sensor_flow_rate_mps REAL,
                    image_flow_rate_mps REAL,
                    image_rise_rate_mps REAL,
                    predicted_level REAL,
                    current_alert_level TEXT,
                    predicted_alert_level TEXT,
                    raw_cv_vectors TEXT
                )
            """)
            conn.commit()

    # --- SENSOR LOGGING ---
    def log_sensor_data(self, water_level, sensor_flow, img_flow, img_rise, pred_level, alert_level, pred_alert_level, raw_vectors):
        """Logs all sensor reading, AI predictions, and raw vectors to local DB."""
        try:
            # Convert raw list of vectors to JSON string for storage
            raw_vectors_json = json.dumps(raw_vectors) if raw_vectors else "[]"
            timestamp = datetime.now().isoformat()

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO sensor_data 
                    (timestamp, water_level_m, sensor_flow_rate_mps, image_flow_rate_mps, 
                     image_rise_rate_mps, predicted_level, current_alert_level, predicted_alert_level, raw_cv_vectors)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (timestamp, water_level, sensor_flow, img_flow, img_rise, pred_level, alert_level, pred_alert_level, raw_vectors_json))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error logging sensor data: {e}")

    # --- RESIDENT MANAGEMENT (Offline Support) ---
    def get_all_registered_phone_numbers(self):
        """Retrieves all registered phone numbers for offline SMS."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT phone_number FROM residents")
            return [row[0] for row in cursor.fetchall()]

    def register_resident(self, phone_number):
        """Registers a resident locally."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO residents (phone_number, registration_date) VALUES (?, ?)",
                               (phone_number, datetime.now().isoformat()))
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # Already registered

    # --- ALERT LOGGING ---
    def log_sent_alert(self, alert_level, message, recipient_count):
        """Logs that an alert was sent (or attempted)."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO sent_alerts (timestamp, alert_level, message, recipient_count) VALUES (?, ?, ?, ?)",
                           (datetime.now().isoformat(), alert_level, message, recipient_count))
            conn.commit()