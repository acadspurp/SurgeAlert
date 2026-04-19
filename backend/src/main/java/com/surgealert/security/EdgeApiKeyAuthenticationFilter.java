package com.surgealert.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Authenticates edge devices using {@code X-Edge-ApiKey} for ingest webhooks.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EdgeApiKeyAuthenticationFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Edge-ApiKey";

    private final byte[] expectedKeyBytes;

    public EdgeApiKeyAuthenticationFilter(@Value("${app.edge-api-key:}") String configuredKey) {
        this.expectedKeyBytes = configuredKey == null ? new byte[0] : configuredKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (!requiresEdgeAuth(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (expectedKeyBytes.length == 0) {
            writeJsonError(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Edge ingest is disabled: app.edge-api-key is not configured.");
            return;
        }

        String provided = request.getHeader(HEADER);
        if (!constantTimeEquals(provided == null ? new byte[0] : provided.getBytes(StandardCharsets.UTF_8), expectedKeyBytes)) {
            writeJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Unauthorized");
            return;
        }

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "edge-ingest",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_EDGE_INGEST"))
        );
        auth.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(auth);
        filterChain.doFilter(request, response);
    }

    private static boolean requiresEdgeAuth(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String path = request.getServletPath();
        return "/api/sensor-data".equals(path) || "/api/external/sms/receive".equals(path);
    }

    private static boolean constantTimeEquals(byte[] a, byte[] b) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hashA = md.digest(a != null ? a : new byte[0]);
            byte[] hashB = md.digest(b != null ? b : new byte[0]);
            return MessageDigest.isEqual(hashA, hashB);
        } catch (Exception e) {
            return false;
        }
    }

    private static void writeJsonError(HttpServletResponse response, int code, String message) throws IOException {
        response.setStatus(code);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"" + message.replace("\"", "'") + "\"}");
    }
}
