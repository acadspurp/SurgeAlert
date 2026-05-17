package com.surgealert.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Requires X-Edge-Key on /api/edge/sync/* (must match Pi EDGE_API_KEY / app.edge-api-key).
 */
@Component
public class EdgeSyncApiKeyInterceptor implements HandlerInterceptor {

    @Value("${app.edge-api-key:}")
    private String edgeApiKey;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!request.getRequestURI().startsWith("/api/edge/sync")) {
            return true;
        }
        if (edgeApiKey == null || edgeApiKey.isBlank()) {
            System.err.println(" [Edge] EDGE_API_KEY not configured — rejecting sync request.");
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Edge API key not configured on server\"}");
            return false;
        }
        String provided = request.getHeader("X-Edge-Key");
        if (provided == null || !edgeApiKey.equals(provided)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\"}");
            return false;
        }
        return true;
    }
}
