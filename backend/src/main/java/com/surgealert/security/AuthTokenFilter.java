package com.surgealert.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class AuthTokenFilter extends OncePerRequestFilter {
    private final SessionTokenService sessionTokenService;

    public AuthTokenFilter(SessionTokenService sessionTokenService) {
        this.sessionTokenService = sessionTokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        return path.startsWith("/api/auth/")
                || path.startsWith("/api/external/")
                || path.equals("/api/sensor-data/latest")
                || path.equals("/api/sensor-data/recent")
                || path.equals("/api/public/alerts/status")
                || path.equals("/api/public/alerts/camera")
                || path.equals("/api/public/config/thresholds")
                || path.equals("/api/public/system/diagnostic")
                || path.equals("/api/public/evacuation-sites")
                || path.equals("/api/public/action-plans")
                || ("GET".equalsIgnoreCase(method) && path.equals("/api/public/alerts/critical/pending"))
                || ("GET".equalsIgnoreCase(method) && path.startsWith("/api/public/alerts/critical/pending/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            sessionTokenService.validateAccessToken(token).ifPresent(user -> {
                List<SimpleGrantedAuthority> authorities = List.of(
                        new SimpleGrantedAuthority("ROLE_" + user.role().toUpperCase())
                );
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(user.username(), null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }
        filterChain.doFilter(request, response);
    }
}
