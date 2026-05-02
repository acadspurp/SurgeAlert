package com.surgealert.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
<<<<<<< HEAD
=======
import org.springframework.http.HttpMethod;
>>>>>>> parent of a64fe6d4 (fix 403 on public external API routes from SPA)
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

<<<<<<< HEAD
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

=======
>>>>>>> parent of a64fe6d4 (fix 403 on public external API routes from SPA)
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
<<<<<<< HEAD
<<<<<<< HEAD
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                // --- ADDED THIS LINE BELOW: Allow registration without login ---
                .requestMatchers("/api/residents/register").permitAll() 
                .requestMatchers("/api/sensor-data/**").permitAll()
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/error").permitAll()
=======
=======
                .requestMatchers(HttpMethod.GET, "/api/external/weather", "/api/external/tides").permitAll()
>>>>>>> parent of a64fe6d4 (fix 403 on public external API routes from SPA)
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
>>>>>>> parent of 464abb32 (tide weather resilience: marine fallback and clearer errors)
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
<<<<<<< HEAD
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "*"));
        configuration.setAllowCredentials(true);
        
=======
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization"));
        configuration.setAllowCredentials(true);

>>>>>>> parent of f04a8668 (fix cross-origin API from Cloudflare to Render)
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}