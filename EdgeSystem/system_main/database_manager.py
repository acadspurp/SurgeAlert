# EdgeSystem/system_main/database_manager.py
import sqlite3
import os
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

            # Table for registered residents (for SMS alerts)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS residents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone_number TEXT UNIQUE NOT NULL,
                    registration_date TEXT NOT NULL
                )
            """)

            # Table for logging sent SMS alerts
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sent_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alert_level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    recipient_count INTEGER NOT NULL,
                    timestamp TEXT NOT NULL
                )
            """)

            # Table for raw sensor data (for future ML training)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sensor_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    water_level_m REAL,
                    sensor_flow_rate_mps REAL,
                    image_flow_rate_mps REAL,
                    image_rise_rate_mps REAL,
                    current_alert_level TEXT
                )
            """)
            conn.commit()
        print("Database tables checked/created successfully.")

    # --- Resident Management ---
    def register_resident(self, phone_number):
        """Registers a new resident's phone number."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                registration_date = datetime.now().isoformat()
                cursor.execute(
                    "INSERT INTO residents (phone_number, registration_date) VALUES (?, ?)",
                    (phone_number, registration_date)
                )
                conn.commit()
                print(f"Resident {phone_number} registered successfully.")
                return True
        except sqlite3.IntegrityError:
            print(f"Resident {phone_number} is already registered.")
            return False
        except Exception as e:
            print(f"Error registering resident {phone_number}: {e}")
            return False

    def get_all_registered_phone_numbers(self):
        """Retrieves all registered phone numbers."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT phone_number FROM residents")
            numbers = [row[0] for row in cursor.fetchall()]
            return numbers

    def unregister_resident(self, phone_number):
        """Removes a resident's phone number."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM residents WHERE phone_number = ?", (phone_number,))
                conn.commit()
                if cursor.rowcount > 0:
                    print(f"Resident {phone_number} unregistered successfully.")
                    return True
                else:
                    print(f"Resident {phone_number} not found.")
                    return False
        except Exception as e:
            print(f"Error unregistering resident {phone_number}: {e}")
            return False

    # --- Alert Logging ---
    def log_sent_alert(self, alert_level, message, recipient_count):
        """Logs details of a sent alert."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                timestamp = datetime.now().isoformat()
                cursor.execute(
                    "INSERT INTO sent_alerts (alert_level, message, recipient_count, timestamp) VALUES (?, ?, ?, ?)",
                    (alert_level, message, recipient_count, timestamp)
                )
                conn.commit()
                print(f"Alert '{alert_level}' logged successfully.")
                return True
        except Exception as e:
            print(f"Error logging alert: {e}")
            return False
    
    # --- Sensor Data Logging (for future ML) ---
    def log_sensor_data(self, water_level_m, sensor_flow_rate_mps, image_flow_rate_mps, image_rise_rate_mps, current_alert_level):
        """Logs sensor readings and derived data."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                timestamp = datetime.now().isoformat()
                cursor.execute(
                    """INSERT INTO sensor_data (timestamp, water_level_m, sensor_flow_rate_mps, 
                                               image_flow_rate_mps, image_rise_rate_mps, current_alert_level) 
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (timestamp, water_level_m, sensor_flow_rate_mps, image_flow_rate_mps, image_rise_rate_mps, current_alert_level)
                )
                conn.commit()
                # print("Sensor data logged.") # Uncomment for debugging, can be verbose
                return True
        except Exception as e:
            print(f"Error logging sensor data: {e}")
            return False

# Example Usage (for testing this module directly)
if __name__ == "__main__":
    db_manager = DatabaseManager()

    # Test resident registration
    print("\n--- Testing Resident Management ---")
    db_manager.register_resident("+639171234567")
    db_manager.register_resident("+639171234567") # Try to register again
    db_manager.register_resident("+639179876543")

    print("Registered numbers:", db_manager.get_all_registered_phone_numbers())

    # Test alert logging
    print("\n--- Testing Alert Logging ---")
    db_manager.log_sent_alert("Green", "Water levels normal.", 2)
    db_manager.log_sent_alert("Yellow", "Rising water, monitor closely.", 2)

    # Test sensor data logging
    print("\n--- Testing Sensor Data Logging ---")
    db_manager.log_sensor_data(1.2, 0.5, 0.45, 0.01, "Green")
    db_manager.log_sensor_data(2.1, 1.1, 1.05, 0.08, "Yellow")

    db_manager.unregister_resident("+639171234567")
    print("Registered numbers after unregister:", db_manager.get_all_registered_phone_numbers())