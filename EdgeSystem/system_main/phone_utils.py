import re


def normalize_ph_mobile(raw):
    """Canonical 10-digit form: 9123456789. Accepts 09..., +639..., 639..., 9..."""
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw).strip())
    if digits.startswith("63") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10 and digits.startswith("9"):
        return digits
    return None


def format_for_gsm(ten_digit):
    """Dial string for SIM7600 AT+CMGS."""
    if not ten_digit:
        return None
    return f"+63{ten_digit}"
