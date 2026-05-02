import os
from config.settings import SMS_TEMPLATES_DIR
from system_main.database_manager import DatabaseManager

class SMSManager:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.templates = {}
        self._load_templates()

    def _load_templates(self):
        """Loads SMS alert messages from text files."""
        for alert_level in ['green', 'yellow', 'orange', 'red']:
            template_path = os.path.join(SMS_TEMPLATES_DIR, f'{alert_level}_alert.txt')
            try:
                with open(template_path, 'r') as f:
                    self.templates[alert_level.upper()] = f.read().strip()
            except FileNotFoundError:
                print(f"Warning: SMS template not found for {alert_level} at {template_path}")
                self.templates[alert_level.upper()] = f"SurgeAlert: {alert_level.upper()} - Message not available."
        print("SMS templates loaded.")

    def get_alert_message(self, alert_level):
        """Retrieves the appropriate message for a given alert level."""
        return self.templates.get(alert_level.upper(), f"SurgeAlert: Unknown Alert Level ({alert_level}).")

    def send_alert(self, alert_level, explicit_recipients=None):
        """
        Sends the alert message. 
        
        Args:
            alert_level (str): The level (RED, ORANGE, etc.)
            explicit_recipients (list): Optional. A list of numbers passed from the Java Backend.
                                        If this is None, the system falls back to the local database.
        """
        message = self.get_alert_message(alert_level)
        
        # LOGIC: Use the list from Java Backend if available. 
        # If not (e.g., offline mode), use the local SQLite database.
        if explicit_recipients and len(explicit_recipients) > 0:
            recipients = explicit_recipients
            source = "Java Backend"
        else:
            recipients = self.db_manager.get_all_registered_phone_numbers()
            source = "Local Database"

        recipient_count = len(recipients)

        if recipient_count == 0:
            print(f"No registered residents to send {alert_level} alert to.")
            return

        print(f"\n--- Sending {alert_level} Alert ---")
        print(f"Source of Numbers: {source}")
        print(f"Message: '{message}'")
        print(f"Recipients: {', '.join(recipients)}")

        # --- GSM MODULE LOGIC (FUTURE) ---
        # This is where you will eventually put the AT Commands for the Sim800L
        # For now, we simulate.
        print(">> SIMULATION: GSM Module initiating...")
        for number in recipients:
            print(f"   -> Sending SMS to {number} ... [SUCCESS]")
        
        # Log the sent alert in the database
        self.db_manager.log_sent_alert(alert_level, message, recipient_count)
        print(f"Alert logged to database.")

# --- TEST ZONE ---
# The code below ONLY runs if you type "python sms_manager.py" in the terminal.
# It DOES NOT run when the main system is running.
if __name__ == "__main__":
    print("--- TESTING SMS MANAGER (ISOLATED) ---")
    
    # 1. Setup a dummy database manager
    db_manager = DatabaseManager()
    
    # 2. Add fake numbers just for this test
    print("Registering test numbers...")
    db_manager.register_resident("+639170000001") 
    
    # 3. Initialize Manager
    sms_manager = SMSManager(db_manager)

    # 4. Test Sending
    sms_manager.send_alert("RED")
    
    # 5. Clean up (optional, to keep your db clean)
    db_manager.unregister_resident("+639170000001")
    print("Test complete.")