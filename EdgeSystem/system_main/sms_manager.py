import os
from config.settings import SMS_TEMPLATES_DIR

class SMSManager:
    def __init__(self, db_manager):
        """
        Initializes the SMS Manager.
        
        Args:
            db_manager: Instance of DatabaseManager to log alerts and fetch offline numbers.
        """
        self.db_manager = db_manager
        self.templates = {}
        self._load_templates()
        print("SMS Manager Initialized (Simulation/Mock Mode).")

    def _load_templates(self):
        """Loads SMS alert messages from text files in the templates directory."""
        # Only load templates for critical levels. Green is usually ignored for SMS.
        for alert_level in ['yellow', 'orange', 'red']:
            template_path = os.path.join(SMS_TEMPLATES_DIR, f'{alert_level}_alert.txt')
            try:
                if os.path.exists(template_path):
                    with open(template_path, 'r') as f:
                        self.templates[alert_level.upper()] = f.read().strip()
                else:
                    # Fallback default message if file is missing
                    self.templates[alert_level.upper()] = f"SurgeAlert: {alert_level.upper()} Level Warning. Please take precautions."
            except Exception as e:
                print(f"Error loading template for {alert_level}: {e}")
                self.templates[alert_level.upper()] = f"SurgeAlert: {alert_level.upper()} Warning."

    def get_alert_message(self, alert_level):
        """Retrieves the appropriate message for a given alert level."""
        return self.templates.get(alert_level.upper(), f"SurgeAlert: Alert Level {alert_level}.")

    def send_alert(self, alert_level, explicit_recipients=None):
        """
        Simulates sending an SMS alert and logs it to the database.
        
        Args:
            alert_level (str): "YELLOW", "ORANGE", or "RED".
            explicit_recipients (list): Optional list of phone numbers from Java Backend.
                                        If None, it fetches from local DB (Offline Mode).
        """
        # Safety Check: We generally do not send SMS for GREEN
        if alert_level.upper() == "GREEN":
            return

        message = self.get_alert_message(alert_level)

        # 1. Determine Recipients
        # Logic: If the Backend provided specific numbers (Online), use them.
        #        If not (Offline/Fail-safe), look in the local Raspberry Pi database.
        source = ""
        recipients = []

        if explicit_recipients and len(explicit_recipients) > 0:
            recipients = explicit_recipients
            source = "Java Backend Command"
        else:
            recipients = self.db_manager.get_all_registered_phone_numbers()
            source = "Local Offline Database (Fail-safe)"

        recipient_count = len(recipients)

        if recipient_count == 0:
            # This usually happens if no one has registered yet
            print(f"[SMS SKIP] No recipients found for {alert_level} alert.")
            return

        # 2. MOCK SENDING (Simulation Logic)
        # This block simulates the GSM hardware. It prints to the console so 
        # you can visually verify it works during your defense.
        print(f"\n[MOCK SMS HARDWARE] --------------------------------")
        print(f"  TYPE: {alert_level} Alert")
        print(f"  SOURCE: {source}")
        print(f"  MESSAGE: \"{message}\"")
        print(f"  RECIPIENTS ({recipient_count}): {recipients}")
        print(f"  STATUS: Sent via Simulation Driver [SUCCESS]")
        print(f"----------------------------------------------------\n")

        # 3. Log to Database (Crucial for Reports)
        # We save this record to prove the system worked.
        self.db_manager.log_sent_alert(alert_level, message, recipient_count)