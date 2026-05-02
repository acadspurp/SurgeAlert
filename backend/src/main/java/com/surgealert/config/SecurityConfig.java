package com.surgealert.config;

import com.surgealert.security.AuthTokenFilter;
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
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final AuthTokenFilter authTokenFilter;

    public SecurityConfig(AuthTokenFilter authTokenFilter) {
        this.authTokenFilter = authTokenFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/external/weather", "/api/external/tides").permitAll()
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
        
        // --- CHANGED TO ALLOW FILE SYSTEM ACCESS (Double-clicking HTML) ---
        // Using allowedOriginPatterns with "*" allows requests from file:// and any IP
        configuration.setAllowedOriginPatterns(List.of("*")); 
        
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