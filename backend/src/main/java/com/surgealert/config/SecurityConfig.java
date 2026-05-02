package com.surgealert.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/refresh", "/api/auth/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/public/alerts/override").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/api/public/alerts/critical/pending/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/api/public/**", "/api/public/system/**", "/api/external/**", "/api/residents/send-otp", "/api/residents/verify-otp", "/api/residents/register", "/api/residents/unsubscribe-otp").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/sensor-data").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/sensor-data/latest").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/external/sms/receive").permitAll()
                .requestMatchers("/api/admin/**", "/api/admin/templates/**", "/api/admin/datasets", "/api/admin/datasets/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/api/sensor-data/recent", "/api/sensor-data/audit", "/api/sensor-data/reports/export").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/api/residents/active", "/api/residents/id/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/error").permitAll()
                .anyRequest().authenticated()
            )
            .headers(headers -> headers.frameOptions(frameOptions -> frameOptions.disable()))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:5500")); // Added 5500 for Live Server
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}