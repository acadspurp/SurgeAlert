# EdgeSystem/tests/test_database_manager.py
import os
from system_main.database_manager import DatabaseManager
from config.settings import DATABASE_PATH

def test_resident_registration():
    print("Testing database resident registration...")
    # Clean up old test db if it exists
    if os.path.exists(DATABASE_PATH):
        os.remove(DATABASE_PATH)
        
    db = DatabaseManager()
    test_number = "+1234567890"
    
    assert db.register_resident(test_number) is True
    assert db.register_resident(test_number) is False # Test duplicate
    
    numbers = db.get_all_registered_phone_numbers()
    assert test_number in numbers
    
    assert db.unregister_resident(test_number) is True
    numbers_after = db.get_all_registered_phone_numbers()
    assert test_number not in numbers_after
    
    print("Database resident registration test PASSED.")

if __name__ == "__main__":
    test_resident_registration()