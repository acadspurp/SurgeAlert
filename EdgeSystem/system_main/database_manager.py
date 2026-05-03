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

            # 2. Sensor Data (Standardized Names + Site Specific)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sensor_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    water_level REAL,
                    sensor_flow_rate_mps REAL,
                    image_flow_rate_mps REAL,
                    rise_rate REAL, 
                    sensor_rise_rate REAL,
                    predicted_level REAL,
                    current_alert_level TEXT,
                    predicted_alert_level TEXT,
                    Tide_Height_m REAL,
                    Tide_Trend REAL,
                    QC_Rain_mm REAL,
                    QC_Lag1 REAL,
                    QC_Lag2 REAL,
                    QC_3hr_Sum REAL,
                    QC_6hr_Sum REAL,
                    Marulas_Rain_mm REAL,
                    Mar_Lag1 REAL,
                    Mar_Lag2 REAL,
                    Mar_3hr_Sum REAL,
                    Mar_6hr_Sum REAL,
                    Mar_24hr_Sum REAL,
                    Pressure_hPa REAL,
                    Press_Trend REAL,
                    Wind_Speed REAL,
                    Wind_Sin REAL,
                    Wind_Cos REAL,
                    Soil_Moisture REAL,
                    predicted_alert_class INTEGER,
                    raw_cv_vectors TEXT,
                    is_synced INTEGER DEFAULT 0
                )
            """)

            # 3. Tide Metrics Table (Raw only as requested)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tide_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    Tide_Height_m REAL
                )
            """)

            # 4. Weather Metrics Table (Dual Location - Raw only)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS weather_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    QC_Rain_mm REAL,
                    Marulas_Rain_mm REAL,
                    Mar_24hr_Sum REAL,
                    Pressure_hPa REAL,
                    Wind_Speed REAL,
                    Soil_Moisture REAL
                )
            """)

            # 5. ML Realtime Features Table (Refined with all 21 professional features)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_features_realtime (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    water_level REAL,
                    rise_rate REAL,
                    sensor_rise_rate REAL,
                    Tide_Height_m REAL,
                    Tide_Trend REAL,
                    QC_Rain_mm REAL,
                    QC_Lag1 REAL,
                    QC_Lag2 REAL,
                    QC_3hr_Sum REAL,
                    QC_6hr_Sum REAL,
                    Marulas_Rain_mm REAL,
                    Mar_Lag1 REAL,
                    Mar_Lag2 REAL,
                    Mar_3hr_Sum REAL,
                    Mar_6hr_Sum REAL,
                    Mar_24hr_Sum REAL,
                    Pressure_hPa REAL,
                    Press_Trend REAL,
                    Wind_Speed REAL,
                    Wind_Sin REAL,
                    Wind_Cos REAL,
                    Soil_Moisture REAL,
                    predicted_alert_class INTEGER
                )
            """)

            # 6. Snapshots Table (For Image History)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sensor_data_id INTEGER,
                    timestamp TEXT NOT NULL,
                    image_base64 TEXT,
                    FOREIGN KEY(sensor_data_id) REFERENCES sensor_data(id)
                )
            """)
            
            # Migration logic (Ensure new professional columns exist)
            try:
                cursor.execute("PRAGMA table_info(ml_features_realtime)")
                ml_cols = [column[1] for column in cursor.fetchall()]
                required_ml = {
                    'Tide_Trend': 'REAL', 'Press_Trend': 'REAL',
                    'Wind_Sin': 'REAL', 'Wind_Cos': 'REAL',
                    'QC_3hr_Sum': 'REAL', 'QC_6hr_Sum': 'REAL'
                }
                for col, dtype in required_ml.items():
                    if col not in ml_cols:
                        cursor.execute(f"ALTER TABLE ml_features_realtime ADD COLUMN {col} {dtype}")
                conn.commit()
            except Exception as e:
                print(f" [DB] Migration Warning: {e}")

    # --- SENSOR LOGGING ---
    def log_sensor_data(self, water_level, sensor_flow, img_flow, img_rise, sensor_rise, 
                        pred_level, alert_level, pred_alert_level, tide_future, tide_trend,
                        weather_data, pred_class, raw_vectors):
        """Logs all sensor readings, AI predictions, and environmental data to local DB."""
        try:
            raw_vectors_json = json.dumps(raw_vectors) if raw_vectors else "[]"
            timestamp = datetime.now().isoformat()

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO sensor_data 
                    (timestamp, water_level, sensor_flow_rate_mps, image_flow_rate_mps, 
                     rise_rate, sensor_rise_rate, predicted_level, current_alert_level, predicted_alert_level, 
                     Tide_Height_m, Tide_Trend, QC_Rain_mm, QC_Lag1, QC_Lag2, QC_3hr_Sum, QC_6hr_Sum,
                     Marulas_Rain_mm, Mar_Lag1, Mar_Lag2, Mar_3hr_Sum, Mar_6hr_Sum, Mar_24hr_Sum, 
                     Pressure_hPa, Press_Trend, Wind_Speed, Wind_Sin, Wind_Cos, Soil_Moisture,
                     predicted_alert_class, raw_cv_vectors, is_synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (timestamp, water_level, sensor_flow, img_flow, img_rise, sensor_rise, 
                      pred_level, alert_level, pred_alert_level, tide_future, tide_trend,
                      weather_data["QC_Rain_mm"], weather_data["QC_Lag1"], weather_data["QC_Lag2"],
                      weather_data["QC_3hr_Sum"], weather_data["QC_6hr_Sum"],
                      weather_data["Marulas_Rain_mm"], weather_data["Mar_Lag1"], weather_data["Mar_Lag2"],
                      weather_data["Mar_3hr_Sum"], weather_data["Mar_6hr_Sum"], weather_data["Mar_24hr_Sum"],
                      weather_data["Pressure_hPa"], weather_data["Press_Trend"], 
                      weather_data["Wind_Speed"], weather_data["Wind_Sin"], weather_data["Wind_Cos"],
                      weather_data["Soil_Moisture_pct"], pred_class, raw_vectors_json))
                inserted_id = cursor.lastrowid
                conn.commit()
                return inserted_id
        except Exception as e:
            print(f" [DB] Error logging sensor data: {e}")
            return None

    def log_tide_metrics(self, tide_height):
        """Logs raw tide data to the tide_metrics table."""
        try:
            timestamp = datetime.now().isoformat()
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO tide_metrics (timestamp, Tide_Height_m)
                    VALUES (?, ?)
                """, (timestamp, tide_height))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error logging tide metrics: {e}")

    def log_weather_metrics(self, weather_data):
        """Logs weather data to the weather_metrics table."""
        try:
            timestamp = datetime.now().isoformat()
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO weather_metrics (timestamp, QC_Rain_mm, Marulas_Rain_mm, Mar_24hr_Sum, Pressure_hPa, Wind_Speed, Soil_Moisture)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (timestamp, weather_data["QC_Rain_mm"], weather_data["Marulas_Rain_mm"], 
                      weather_data["Mar_24hr_Sum"], weather_data["Pressure_hPa"], 
                      weather_data["Wind_Speed"], weather_data["Soil_Moisture_pct"]))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error logging weather metrics: {e}")

    def log_ml_features(self, water_level, rise_rate, sensor_rise, tide_future, tide_trend, weather_data, pred_class):
        """Logs ML features to the ml_features_realtime table."""
        try:
            timestamp = datetime.now().isoformat()
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO ml_features_realtime 
                    (timestamp, water_level, rise_rate, sensor_rise_rate, Tide_Height_m, Tide_Trend,
                     QC_Rain_mm, QC_Lag1, QC_Lag2, QC_3hr_Sum, QC_6hr_Sum,
                     Marulas_Rain_mm, Mar_Lag1, Mar_Lag2, Mar_3hr_Sum, Mar_6hr_Sum, Mar_24hr_Sum, 
                     Pressure_hPa, Press_Trend, Wind_Speed, Wind_Sin, Wind_Cos, Soil_Moisture, 
                     predicted_alert_class)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (timestamp, water_level, rise_rate, sensor_rise, tide_future, tide_trend,
                      weather_data["QC_Rain_mm"], weather_data["QC_Lag1"], weather_data["QC_Lag2"],
                      weather_data["QC_3hr_Sum"], weather_data["QC_6hr_Sum"],
                      weather_data["Marulas_Rain_mm"], weather_data["Mar_Lag1"], weather_data["Mar_Lag2"],
                      weather_data["Mar_3hr_Sum"], weather_data["Mar_6hr_Sum"], weather_data["Mar_24hr_Sum"],
                      weather_data["Pressure_hPa"], weather_data["Press_Trend"], 
                      weather_data["Wind_Speed"], weather_data["Wind_Sin"], weather_data["Wind_Cos"],
                      weather_data["Soil_Moisture_pct"], pred_class))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error logging ML features: {e}")

    def log_snapshot(self, sensor_data_id, image_base64):
        """Logs image snapshot to the snapshots table."""
        try:
            timestamp = datetime.now().isoformat()
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO snapshots (sensor_data_id, timestamp, image_base64)
                    VALUES (?, ?, ?)
                """, (sensor_data_id, timestamp, image_base64))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error logging snapshot: {e}")

    def get_unsynced_data(self, limit=50):
        """Retrieves unsynced sensor data."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM sensor_data
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

    # --- RESIDENT MANAGEMENT ---
    def get_all_registered_phone_numbers(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT phone_number FROM residents")
            return [row[0] for row in cursor.fetchall()]

    def register_resident(self, phone_number):
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO residents (phone_number, registration_date) VALUES (?, ?)",
                               (phone_number, datetime.now().isoformat()))
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False 

    def log_sent_alert(self, alert_level, message, recipient_count):
        return