package com.surgealert.config;

import com.surgealert.security.AuthTokenFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final AuthTokenFilter authTokenFilter;
    @Value("${surgealert.cors.allowed-origin-patterns:http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173}")
    private String corsAllowedOriginPatterns;

    public SecurityConfig(AuthTokenFilter authTokenFilter) {
        this.authTokenFilter = authTokenFilter;
    }

    /**
     * Public APIs used by the resident dashboard and external integrations must not run
     * behind AuthTokenFilter. This avoids 403 regressions from stale Authorization headers.
     * Stale/invalid Bearer tokens on cross-origin browser requests can otherwise yield HTTP 403.
     */
    @Bean
    @Order(0)
    public SecurityFilterChain publicApiSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher(
                        "/api/public/**",
                        "/api/external/**",
                        "/api/sensor-data/latest",
                        "/api/sensor-data/recent"
                )
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/public/alerts/override").hasRole("HEAD_ADMIN")
                        .requestMatchers("/api/public/alerts/critical/pending/*/approve").hasRole("HEAD_ADMIN")
                        .requestMatchers("/api/public/alerts/critical/pending/*/reject").hasRole("HEAD_ADMIN")
                        .anyRequest().permitAll());
        return http.build();
    }

    @Bean
    @Order(1)
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/external/**").permitAll()
                .requestMatchers("/api/edge/sync/**").permitAll()
                .requestMatchers(
                        "/api/residents/send-otp",
                        "/api/residents/verify-otp",
                        "/api/residents/register",
                        "/api/residents/unsubscribe-otp"
                ).permitAll()
                // Belt-and-suspenders: if the @Order(0) chain does not match on deploy, these must stay public.
                .requestMatchers(HttpMethod.GET,
                        "/api/sensor-data/latest",
                        "/api/sensor-data/recent",
                        "/api/public/alerts/status",
                        "/api/public/alerts/camera",
                        "/api/public/config/**",
                        "/api/public/evacuation-sites",
                        "/api/public/action-plans",
                        "/api/public/system/diagnostic"
                ).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/public/alerts/critical/pending/**").permitAll()
                .requestMatchers("/api/residents/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/api/sensor-data/reports/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(
                Arrays.stream(corsAllowedOriginPatterns.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList()
        );
        
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization"));
        // Bearer tokens do not require credentialed CORS; false avoids browser issues with
        // wildcard origins when the SPA is hosted on another domain (e.g. Cloudflare Pages → Render).
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}