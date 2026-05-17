import sqlite3
import os
import json
from datetime import datetime, timedelta
from config.settings import DATABASE_DIR, DATABASE_PATH, LOCAL_SYNCED_RETAIN_DAYS
from system_main.edge_time_utils import grid_timestamp_iso

class DatabaseManager:
    def __init__(self):
        # Ensure the database directory exists
        os.makedirs(DATABASE_DIR, exist_ok=True)
        self.database_path = DATABASE_PATH
        self._create_tables()
        self._drop_legacy_tables()

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
                    registration_date TEXT NOT NULL,
                    is_priority INTEGER DEFAULT 0
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
                    image_bytes TEXT,
                    is_synced INTEGER DEFAULT 0
                )
            """)

            # 3. ML Realtime Features Table (cloud cache for offline inference)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_features_realtime (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    water_level REAL,
                    rise_rate REAL,
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

            # 4. Alert Templates (Synced from Backend)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS alert_templates (
                    alert_type TEXT PRIMARY KEY,
                    template TEXT NOT NULL
                )
            """)

            # 5. OTP Cache (Synced from Backend for offline verification)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS otp_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    otp_code TEXT NOT NULL,
                    phone_number TEXT NOT NULL,
                    expires_at TEXT NOT NULL
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

            try:
                cursor.execute("PRAGMA table_info(sensor_data)")
                sd_cols = [column[1] for column in cursor.fetchall()]
                if "image_bytes" not in sd_cols:
                    cursor.execute("ALTER TABLE sensor_data ADD COLUMN image_bytes TEXT")
                conn.commit()
            except Exception as e:
                print(f" [DB] sensor_data migration warning: {e}")

            try:
                cursor.execute("PRAGMA table_info(residents)")
                res_cols = [column[1] for column in cursor.fetchall()]
                if "is_priority" not in res_cols:
                    cursor.execute("ALTER TABLE residents ADD COLUMN is_priority INTEGER DEFAULT 0")
                conn.commit()
            except Exception as e:
                print(f" [DB] residents migration warning: {e}")

    def _drop_legacy_tables(self):
        """Remove unused Pi tables (images live in sensor_data.image_bytes)."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                for table in ("snapshots", "tide_metrics", "weather_metrics"):
                    cursor.execute(f"DROP TABLE IF EXISTS {table}")
                conn.commit()
                print(" [DB] Legacy tables removed (snapshots, tide_metrics, weather_metrics).")
        except Exception as e:
            print(f" [DB] Legacy table drop warning: {e}")

    # --- SENSOR LOGGING ---
    def log_sensor_data(self, reading, raw_vectors=None, image_bytes=None):
        """Logs core edge telemetry (environmental data lives in ml_features_realtime cache)."""
        try:
            raw_vectors_json = json.dumps(raw_vectors) if raw_vectors else "[]"
            timestamp = reading.get("timestamp") or grid_timestamp_iso()

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO sensor_data 
                    (timestamp, water_level, sensor_flow_rate_mps, image_flow_rate_mps, 
                     rise_rate, predicted_level, current_alert_level, predicted_alert_level,
                     raw_cv_vectors, image_bytes, is_synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    timestamp,
                    reading["water_level"],
                    reading["sensor_flow_rate_mps"],
                    reading["image_flow_rate_mps"],
                    reading["rise_rate"],
                    reading["predicted_level"],
                    reading["current_alert_level"],
                    reading["predicted_alert_level"],
                    raw_vectors_json,
                    image_bytes,
                ))
                inserted_id = cursor.lastrowid
                conn.commit()
                return inserted_id
        except Exception as e:
            print(f" [DB] Error logging sensor data: {e}")
            return None

    def cache_ml_features_row(self, ml_row, water_level=None, rise_rate_mph=None, pred_class=None):
        """Persist latest ml_features_realtime from cloud or cycle context."""
        try:
            weather = {
                "QC_Rain_mm": ml_row.get("QC_Rain_mm", 0.0),
                "QC_Lag1": ml_row.get("QC_Lag1", 0.0),
                "QC_Lag2": ml_row.get("QC_Lag2", 0.0),
                "QC_3hr_Sum": ml_row.get("QC_3hr_Sum", 0.0),
                "QC_6hr_Sum": ml_row.get("QC_6hr_Sum", 0.0),
                "Marulas_Rain_mm": ml_row.get("Marulas_Rain_mm", 0.0),
                "Mar_Lag1": ml_row.get("Mar_Lag1", 0.0),
                "Mar_Lag2": ml_row.get("Mar_Lag2", 0.0),
                "Mar_3hr_Sum": ml_row.get("Mar_3hr_Sum", 0.0),
                "Mar_6hr_Sum": ml_row.get("Mar_6hr_Sum", 0.0),
                "Mar_24hr_Sum": ml_row.get("Mar_24hr_Sum", 0.0),
                "Pressure_hPa": ml_row.get("Pressure_hPa", 1013.0),
                "Press_Trend": ml_row.get("Press_Trend", 0.0),
                "Wind_Speed": ml_row.get("Wind_Speed", 0.0),
                "Wind_Sin": ml_row.get("Wind_Sin", 0.0),
                "Wind_Cos": ml_row.get("Wind_Cos", 0.0),
                "Soil_Moisture": ml_row.get("Soil_Moisture", 0.0),
            }
            timestamp = ml_row.get("timestamp") or grid_timestamp_iso()
            tide_h = ml_row.get("Tide_Height_m") or ml_row.get("tideHeightM") or 0.0
            tide_trend = ml_row.get("Tide_Trend") or ml_row.get("tideTrend") or 0.0
            wl = water_level if water_level is not None else ml_row.get("water_level", 0.0)
            rr = rise_rate_mph if rise_rate_mph is not None else ml_row.get("rise_rate", 0.0)
            pc = pred_class if pred_class is not None else ml_row.get("predicted_alert_class", 0)

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO ml_features_realtime 
                    (timestamp, water_level, rise_rate, Tide_Height_m, Tide_Trend,
                     QC_Rain_mm, QC_Lag1, QC_Lag2, QC_3hr_Sum, QC_6hr_Sum,
                     Marulas_Rain_mm, Mar_Lag1, Mar_Lag2, Mar_3hr_Sum, Mar_6hr_Sum, Mar_24hr_Sum, 
                     Pressure_hPa, Press_Trend, Wind_Speed, Wind_Sin, Wind_Cos, Soil_Moisture, 
                     predicted_alert_class)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (timestamp, wl, rr, tide_h, tide_trend,
                      weather["QC_Rain_mm"], weather["QC_Lag1"], weather["QC_Lag2"],
                      weather["QC_3hr_Sum"], weather["QC_6hr_Sum"],
                      weather["Marulas_Rain_mm"], weather["Mar_Lag1"], weather["Mar_Lag2"],
                      weather["Mar_3hr_Sum"], weather["Mar_6hr_Sum"], weather["Mar_24hr_Sum"],
                      weather["Pressure_hPa"], weather["Press_Trend"],
                      weather["Wind_Speed"], weather["Wind_Sin"], weather["Wind_Cos"],
                      weather["Soil_Moisture"], pc))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error caching ML features: {e}")

    def get_latest_ml_features_cached(self):
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT timestamp, water_level, rise_rate, Tide_Height_m, Tide_Trend,
                           QC_Rain_mm, QC_Lag1, QC_Lag2, QC_3hr_Sum, QC_6hr_Sum,
                           Marulas_Rain_mm, Mar_Lag1, Mar_Lag2, Mar_3hr_Sum, Mar_6hr_Sum, Mar_24hr_Sum,
                           Pressure_hPa, Press_Trend, Wind_Speed, Wind_Sin, Wind_Cos, Soil_Moisture,
                           predicted_alert_class
                    FROM ml_features_realtime ORDER BY id DESC LIMIT 1
                """)
                row = cursor.fetchone()
                if not row:
                    return None
                keys = [
                    "timestamp", "water_level", "rise_rate", "Tide_Height_m", "Tide_Trend",
                    "QC_Rain_mm", "QC_Lag1", "QC_Lag2", "QC_3hr_Sum", "QC_6hr_Sum",
                    "Marulas_Rain_mm", "Mar_Lag1", "Mar_Lag2", "Mar_3hr_Sum", "Mar_6hr_Sum", "Mar_24hr_Sum",
                    "Pressure_hPa", "Press_Trend", "Wind_Speed", "Wind_Sin", "Wind_Cos", "Soil_Moisture",
                    "predicted_alert_class",
                ]
                return dict(zip(keys, row))
        except Exception as e:
            print(f" [DB] Error reading ML cache: {e}")
            return None

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

    def purge_old_synced_rows(self, retain_days=None):
        """Free SD space after cloud sync."""
        retain_days = retain_days if retain_days is not None else LOCAL_SYNCED_RETAIN_DAYS
        try:
            cutoff = (datetime.now() - timedelta(days=retain_days)).isoformat()
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM sensor_data WHERE is_synced = 1 AND timestamp < ?", (cutoff,))
                deleted = cursor.rowcount
                conn.commit()
                if deleted:
                    print(f" [DB] Purged {deleted} synced sensor_data row(s) older than {retain_days}d.")
        except Exception as e:
            print(f" [DB] Purge error: {e}")

    # --- RESIDENT MANAGEMENT ---
    def get_residents_for_sms(self):
        """Priority residents first, then registration order."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT phone_number FROM residents
                ORDER BY is_priority DESC, id ASC
            """)
            return [row[0] for row in cursor.fetchall()]

    # --- SYNC HELPERS ---
    def sync_residents(self, residents):
        """Re-populate residents from backend (strings or {phoneNumber, isPriority})."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM residents")
                now = datetime.now().isoformat()
                count = 0
                for entry in residents:
                    if isinstance(entry, str):
                        phone, priority = entry, 0
                    else:
                        phone = entry.get("phoneNumber") or entry.get("phone_number") or entry.get("phone")
                        priority = 1 if entry.get("isPriority") or entry.get("is_priority") else 0
                    if not phone:
                        continue
                    cursor.execute(
                        "INSERT OR IGNORE INTO residents (phone_number, registration_date, is_priority) VALUES (?, ?, ?)",
                        (phone, now, priority),
                    )
                    count += 1
                conn.commit()
                print(f" [DB] Synced {count} residents (priority ordering enabled).")
        except Exception as e:
            print(f" [DB] Error syncing residents: {e}")

    def sync_templates(self, templates_list):
        """Updates local SMS templates."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                for t in templates_list:
                    cursor.execute("INSERT OR REPLACE INTO alert_templates (alert_type, template) VALUES (?, ?)",
                                 (t['alertType'].upper(), t['template']))
                conn.commit()
                print(f" [DB] Synced {len(templates_list)} templates.")
        except Exception as e:
            print(f" [DB] Error syncing templates: {e}")

    def sync_otps(self, otp_map):
        """Updates local OTP cache from backend snapshot."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                # We don't delete everything, just update/insert. 
                # cleanup_expired_otps will handle the 20-min rule.
                from datetime import timedelta
                expiry = (datetime.now() + timedelta(minutes=20)).isoformat()
                for phone, code in otp_map.items():
                    cursor.execute("INSERT OR REPLACE INTO otp_cache (otp_code, phone_number, expires_at) VALUES (?, ?, ?)",
                                 (code, phone, expiry))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error syncing OTPs: {e}")

    def cleanup_expired_otps(self):
        """Deletes OTPs older than their expiry time (20 mins)."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                now = datetime.now().isoformat()
                cursor.execute("DELETE FROM otp_cache WHERE expires_at < ?", (now,))
                conn.commit()
        except Exception as e:
            print(f" [DB] Error cleaning up OTPs: {e}")

    def get_template(self, alert_type):
        """Retrieves a specific template from the local DB."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT template FROM alert_templates WHERE alert_type = ?", (alert_type.upper(),))
                row = cursor.fetchone()
                return row[0] if row else None
        except Exception:
            return None

    def log_sent_alert(self, alert_level, message, recipient_count):
        return