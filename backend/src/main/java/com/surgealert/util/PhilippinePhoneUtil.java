package com.surgealert.util;

/**
 * Normalizes Philippine mobile numbers for storage (10-digit 9XXXXXXXXX),
 * Semaphore (09XXXXXXXXX), and GSM AT dial (+639XXXXXXXXX).
 */
public final class PhilippinePhoneUtil {

    private PhilippinePhoneUtil() {}

    /** Canonical form stored in DB and OTP map: 9123456789 */
    public static String normalizeToTenDigit(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.startsWith("63") && digits.length() == 12) {
            digits = digits.substring(2);
        } else if (digits.startsWith("0") && digits.length() == 11) {
            digits = digits.substring(1);
        }
        if (digits.length() == 10 && digits.startsWith("9")) {
            return digits;
        }
        return null;
    }

    /** Semaphore: 09XXXXXXXXX */
    public static String toSemaphoreDial(String tenDigit) {
        return tenDigit == null ? null : "0" + tenDigit;
    }

    /** SIM7600 / international dial: +639XXXXXXXXX */
    public static String toGsmDial(String tenDigit) {
        return tenDigit == null ? null : "+63" + tenDigit;
    }
}
