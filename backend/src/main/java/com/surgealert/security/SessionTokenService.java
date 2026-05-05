package com.surgealert.security;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionTokenService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final long ACCESS_TTL_SECONDS = Duration.ofMinutes(20).toSeconds();
    private static final long SESSION_TTL_SECONDS = Duration.ofHours(12).toSeconds();
    private static final int MAX_REFRESHES = 3;

    private final Map<String, SessionRecord> accessTokens = new ConcurrentHashMap<>();
    private final Map<String, SessionRecord> refreshTokens = new ConcurrentHashMap<>();

    public TokenPair issueTokens(Long userId, String username, String role) {
        Instant now = Instant.now();
        Instant accessExpiresAt = now.plusSeconds(ACCESS_TTL_SECONDS);
        Instant sessionExpiresAt = now.plusSeconds(SESSION_TTL_SECONDS);
        SessionRecord session = new SessionRecord(userId, username, role, sessionExpiresAt, 0);

        String accessToken = generateSecureToken();
        String refreshToken = generateSecureToken();
        accessTokens.put(accessToken, session.withAccessExpiry(accessExpiresAt));
        refreshTokens.put(refreshToken, session);

        return new TokenPair(accessToken, refreshToken, accessExpiresAt.toString(), MAX_REFRESHES);
    }

    public Optional<AuthenticatedUser> validateAccessToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        SessionRecord record = accessTokens.get(token);
        if (record == null || record.accessExpiry == null || Instant.now().isAfter(record.accessExpiry) || Instant.now().isAfter(record.sessionExpiry)) {
            accessTokens.remove(token);
            return Optional.empty();
        }
        return Optional.of(new AuthenticatedUser(record.userId, record.username, record.role));
    }

    public Optional<TokenPair> refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return Optional.empty();
        }
        SessionRecord current = refreshTokens.get(refreshToken);
        if (current == null || Instant.now().isAfter(current.sessionExpiry) || current.refreshCount >= MAX_REFRESHES) {
            refreshTokens.remove(refreshToken);
            return Optional.empty();
        }

        refreshTokens.remove(refreshToken);
        SessionRecord next = new SessionRecord(
                current.userId,
                current.username,
                current.role,
                current.sessionExpiry,
                current.refreshCount + 1
        );

        String nextAccessToken = generateSecureToken();
        String nextRefreshToken = generateSecureToken();
        Instant accessExpiresAt = Instant.now().plusSeconds(ACCESS_TTL_SECONDS);

        accessTokens.put(nextAccessToken, next.withAccessExpiry(accessExpiresAt));
        refreshTokens.put(nextRefreshToken, next);

        return Optional.of(new TokenPair(
                nextAccessToken,
                nextRefreshToken,
                accessExpiresAt.toString(),
                MAX_REFRESHES - next.refreshCount
        ));
    }

    public void revoke(String accessToken, String refreshToken) {
        if (accessToken != null && !accessToken.isBlank()) {
            accessTokens.remove(accessToken);
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokens.remove(refreshToken);
        }
    }

    private static String generateSecureToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static final class SessionRecord {
        private final Long userId;
        private final String username;
        private final String role;
        private final Instant sessionExpiry;
        private final int refreshCount;
        private final Instant accessExpiry;

        private SessionRecord(Long userId, String username, String role, Instant sessionExpiry, int refreshCount) {
            this(userId, username, role, sessionExpiry, refreshCount, null);
        }

        private SessionRecord(Long userId, String username, String role, Instant sessionExpiry, int refreshCount, Instant accessExpiry) {
            this.userId = userId;
            this.username = username;
            this.role = role;
            this.sessionExpiry = sessionExpiry;
            this.refreshCount = refreshCount;
            this.accessExpiry = accessExpiry;
        }

        private SessionRecord withAccessExpiry(Instant expiry) {
            return new SessionRecord(userId, username, role, sessionExpiry, refreshCount, expiry);
        }
    }

    public record TokenPair(String accessToken, String refreshToken, String accessExpiresAt, int refreshesRemaining) {}
}
