package com.surgealert.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_SECONDS = 60;

    private final Map<String, Counter> counters = new ConcurrentHashMap<>();

    @Value("${surgealert.rate-limit.default-per-minute:120}")
    private int defaultLimit;

    @Value("${surgealert.rate-limit.auth-per-minute:12}")
    private int authLimit;

    @Value("${surgealert.rate-limit.otp-per-minute:8}")
    private int otpLimit;

    @Value("${surgealert.rate-limit.reports-per-minute:5}")
    private int reportsLimit;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = resolveClientIp(request);
        int limit = resolveLimit(path, method);
        String key = clientIp + "|" + method + "|" + normalizePath(path);

        if (isLimited(key, limit)) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests. Please retry shortly.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private int resolveLimit(String path, String method) {
        if (path.startsWith("/api/auth/")) return authLimit;
        if (path.startsWith("/api/residents/send-otp") || path.startsWith("/api/residents/verify-otp") || path.startsWith("/api/residents/unsubscribe-otp")) {
            return otpLimit;
        }
        if ("GET".equalsIgnoreCase(method) && path.startsWith("/api/sensor-data/reports/export")) return reportsLimit;
        return defaultLimit;
    }

    private static String normalizePath(String path) {
        if (path.startsWith("/api/admin/datasets/")) return "/api/admin/datasets/*";
        return path;
    }

    private boolean isLimited(String key, int limit) {
        long now = Instant.now().getEpochSecond();
        Counter counter = counters.computeIfAbsent(key, ignored -> new Counter(now, 0));
        synchronized (counter) {
            if (now - counter.windowStart >= WINDOW_SECONDS) {
                counter.windowStart = now;
                counter.count = 0;
            }
            counter.count += 1;
            return counter.count > limit;
        }
    }

    private static String resolveClientIp(HttpServletRequest request) {
        String header = request.getHeader("X-Forwarded-For");
        if (header != null && !header.isBlank()) {
            return header.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class Counter {
        private long windowStart;
        private int count;

        private Counter(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
