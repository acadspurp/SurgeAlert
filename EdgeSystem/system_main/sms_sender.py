# EdgeSystem/system_main/sms_sender.py
import os
from config.settings import SMS_TEMPLATES_DIR, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
from system_main.database_manager import DatabaseManager

# For Twilio integration:
# from twilio.rest import Client # Uncomment this when you install Twilio

class SMSSender:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.templates = {}
        self._load_templates()

        # Initialize Twilio client IF using Twilio and credentials are set
        # if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
        #     self.twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        # else:
        #     self.twilio_client = None
        #     print("Twilio credentials not fully configured. SMS sending will be simulated.")
        self.twilio_client = None # For now, always simulate

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

    def send_alert(self, alert_level):
        """
        Sends the alert message to all registered residents.
        Currently simulates sending if Twilio is not configured.
        """
        message = self.get_alert_message(alert_level)
        recipients = self.db_manager.get_all_registered_phone_numbers()
        recipient_count = len(recipients)

        if recipient_count == 0:
            print(f"No registered residents to send {alert_level} alert to.")
            return

        print(f"\n--- Sending {alert_level} Alert ---")
        print(f"Message: '{message}'")
        print(f"Recipients: {', '.join(recipients)}")

        if self.twilio_client:
            # --- ACTUAL TWILIO SENDING (Uncomment when ready) ---
            for number in recipients:
                try:
                    # message = self.twilio_client.messages.create(
                    #     to=number,
                    #     from_=TWILIO_PHONE_NUMBER,
                    #     body=message
                    # )
                    # print(f"Sent {alert_level} alert to {number} (SID: {message.sid})")
                    pass # Remove this 'pass' when uncommenting above
                except Exception as e:
                    print(f"Error sending SMS to {number}: {e}")
        else:
            print("SIMULATING SMS sending. No actual messages sent.")
            # Simulate a delay for demonstration
            # import time
            # time.sleep(0.5 * recipient_count)

        # Log the sent alert in the database
        self.db_manager.log_sent_alert(alert_level, message, recipient_count)
        print(f"Simulated {alert_level} alert sent to {recipient_count} residents and logged.")

# Example Usage (for testing this module directly)
if __name__ == "__main__":
    db_manager = DatabaseManager()
    db_manager.register_resident("+639171112222") # Make sure some residents are registered
    db_manager.register_resident("+639173334444")
    
    sms_sender = SMSSender(db_manager)

    sms_sender.send_alert("GREEN")
    sms_sender.send_alert("YELLOW")
    sms_sender.send_alert("ORANGE")
    sms_sender.send_alert("RED")
    sms_sender.send_alert("UNKNOWN") # Test unknown alert level