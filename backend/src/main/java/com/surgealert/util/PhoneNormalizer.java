package com.surgealert.util;

/**
 * Normalizes Philippine-style numbers for storage, hashing, and OTP keys.
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw.trim().replaceAll("\\s+", "");
        if (s.startsWith("+")) {
            s = s.substring(1).replaceAll("\\D", "");
        } else {
            s = s.replaceAll("\\D", "");
        }
        if (s.startsWith("0") && s.length() >= 10) {
            s = "63" + s.substring(1);
        }
        if (s.startsWith("9") && s.length() == 10) {
            s = "63" + s;
        }
        return s;
    }
}
