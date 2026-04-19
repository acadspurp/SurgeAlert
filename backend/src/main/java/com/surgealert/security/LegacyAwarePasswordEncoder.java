package com.surgealert.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Accepts legacy plaintext passwords for one successful login, then callers should re-encode to BCrypt.
 */
public class LegacyAwarePasswordEncoder implements PasswordEncoder {

    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder(12);

    @Override
    public String encode(CharSequence rawPassword) {
        return bcrypt.encode(rawPassword);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encoded) {
        if (encoded == null) {
            return false;
        }
        String e = encoded.trim();
        if (e.startsWith("$2a$") || e.startsWith("$2b$") || e.startsWith("$2y$")) {
            return bcrypt.matches(rawPassword, e);
        }
        return rawPassword != null && rawPassword.toString().equals(e);
    }
}
