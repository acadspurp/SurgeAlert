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

            # 2. Privacy hardening: remove historical SMS broadcast logs.
            cursor.execute("DROP TABLE IF EXISTS sent_alerts")

            # 3. Sensor Data (UPDATED with predicted_alert_level and is_synced)
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
                    raw_cv_vectors TEXT,
                    is_synced INTEGER DEFAULT 0
                )
            """)
            
            # Check if is_synced column exists (for backward compatibility if table already created)
            cursor.execute("PRAGMA table_info(sensor_data)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'is_synced' not in columns:
                cursor.execute("ALTER TABLE sensor_data ADD COLUMN is_synced INTEGER DEFAULT 0")
                
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
                     image_rise_rate_mps, predicted_level, current_alert_level, predicted_alert_level, raw_cv_vectors, is_synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (timestamp, water_level, sensor_flow, img_flow, img_rise, pred_level, alert_level, pred_alert_level, raw_vectors_json))
                inserted_id = cursor.lastrowid
                conn.commit()
                return inserted_id
        except Exception as e:
            print(f" [DB] Error logging sensor data: {e}")
            return None

    def get_unsynced_data(self, limit=50):
        """Retrieves unsynced sensor data."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, water_level_m, sensor_flow_rate_mps, image_flow_rate_mps, 
                           image_rise_rate_mps, current_alert_level, predicted_level, predicted_alert_level
                    FROM sensor_data
                    WHERE is_synced = 0
                    ORDER BY id ASC LIMIT ?
                """, (limit,))
                columns = [col[0] for col in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            print(f" [DB] Error retrieving unsynced data: {e}")
            return []

    def mark_data_synced(self, record_ids):
        """Marks a list of record IDs as synced."""
        if not record_ids:
            return
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                placeholders = ','.join('?' * len(record_ids))
                cursor.execute(f"UPDATE sensor_data SET is_synced = 1 WHERE id IN ({placeholders})", record_ids)
                conn.commit()
        except Exception as e:
            print(f" [DB] Error marking data as synced: {e}")

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
        """Intentionally disabled to avoid storing SMS broadcast history."""
        return