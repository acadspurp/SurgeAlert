package com.surgealert.service;

import com.surgealert.util.PhoneNormalizer;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ResidentProofService {

    public enum Kind {
        REGISTER,
        UNSUBSCRIBE
    }

    private record Proof(String normalizedPhone, Instant expires, Kind kind) {}

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Proof> tokens = new ConcurrentHashMap<>();

    public String issue(String rawOrNormalizedPhone, Kind kind) {
        purgeExpired();
        String normalized = PhoneNormalizer.normalize(rawOrNormalizedPhone);
        byte[] buf = new byte[24];
        random.nextBytes(buf);
        String token = toUrlToken(buf);
        tokens.put(token, new Proof(normalized, Instant.now().plusSeconds(900), kind));
        return token;
    }

    public void verifyAndConsume(String token, String bodyPhone, Kind expectedKind) {
        purgeExpired();
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Missing proof token");
        }
        Proof p = tokens.remove(token);
        if (p == null || p.expires.isBefore(Instant.now())) {
            throw new IllegalArgumentException("Invalid or expired proof token");
        }
        if (p.kind != expectedKind) {
            throw new IllegalArgumentException("Invalid proof token type");
        }
        String n = PhoneNormalizer.normalize(bodyPhone);
        if (!p.normalizedPhone.equals(n)) {
            throw new IllegalArgumentException("Phone does not match verified session");
        }
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        for (Iterator<Map.Entry<String, Proof>> it = tokens.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, Proof> e = it.next();
            if (e.getValue().expires.isBefore(now)) {
                it.remove();
            }
        }
    }

    private static String toUrlToken(byte[] buf) {
        StringBuilder sb = new StringBuilder(buf.length * 2);
        for (byte b : buf) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
