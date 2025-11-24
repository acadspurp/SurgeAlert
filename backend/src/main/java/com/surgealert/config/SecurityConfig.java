package com.surgealert.config;


import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
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
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF as we use JWT and are stateless
            .csrf(csrf -> csrf.disable())
           
            // Enable CORS using the configuration below
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
           
            // Set session management to stateless (no server-side sessions)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
           
            // Define URL access rules
            .authorizeHttpRequests(auth -> auth
                // 1. PUBLIC ENDPOINTS (Frontend Dashboard)
                .requestMatchers("/api/public/**").permitAll()      // Action Plans, Alert Status, Camera
               
                // 2. EXTERNAL APIS (Weather & Tides) - FIXED: Was missing
                .requestMatchers("/api/external/**").permitAll()
               
                // 3. HARDWARE & SENSOR DATA
                .requestMatchers("/api/sensor-data/**").permitAll() // Hardware POSTs and Frontend GETs
               
                // 4. RESIDENTS (Registration & OTP) - FIXED: Changed to wildcard to allow send/verify OTP
                .requestMatchers("/api/residents/**").permitAll()
               
                // 5. AUTHENTICATION (Login/Sync)
                .requestMatchers("/api/auth/**").permitAll()
               
                // 6. DEV TOOLS & ERRORS
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/error").permitAll()
               
                // 7. EVERYTHING ELSE (Admin Dashboard) REQUIRES LOGIN
                .anyRequest().authenticated()
            )
           
            // Allow H2 Console frames
            .headers(headers -> headers.frameOptions(frameOptions -> frameOptions.disable()))
           
            // Add the JWT Filter
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);


        return http.build();
    }


    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
       
        // Allow all common local development ports
        configuration.setAllowedOrigins(List.of(
            "http://localhost:3000",      // React/Next.js default
            "http://localhost:8080",      // Spring Boot itself
            "http://localhost:5173",      // Vite/Vue default
            "http://127.0.0.1:5500",      // VS Code Live Server IP
            "http://localhost:5500"       // VS Code Live Server Localhost
        ));
       
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "*"));
        configuration.setAllowCredentials(true);
       
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

