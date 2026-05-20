package com.surgealert.service;

import java.time.Instant;

/** In-memory OTP record; expires after configured TTL (default 10 minutes). */
final class OtpEntry {
    final String code;
    final Instant expiresAt;

    OtpEntry(String code, Instant expiresAt) {
        this.code = code;
        this.expiresAt = expiresAt;
    }

    boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
