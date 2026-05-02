# EdgeSystem/tests/test_alert_manager.py
from alert_logic.alert_manager import AlertManager

def test_alert_levels():
    print("Testing alert manager logic...")
    manager = AlertManager()
    assert manager.determine_alert_level(1.0, 0.5, 0.01) == "GREEN"
    assert manager.determine_alert_level(1.6, 0.5, 0.01) == "YELLOW"
    assert manager.determine_alert_level(2.6, 1.0, 0.1) == "ORANGE"
    assert manager.determine_alert_level(3.6, 2.0, 0.2) == "RED"
    print("Alert manager logic test PASSED.")

if __name__ == "__main__":
    test_alert_levels()