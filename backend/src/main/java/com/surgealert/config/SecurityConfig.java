package com.surgealert.config;

import com.surgealert.security.EdgeApiKeyAuthenticationFilter;
import com.surgealert.security.JwtAuthenticationFilter;
import com.surgealert.security.SurgeUserDetailsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import com.surgealert.security.LegacyAwarePasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final SurgeUserDetailsService userDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final EdgeApiKeyAuthenticationFilter edgeApiKeyAuthenticationFilter;

    @Value("${surgealert.cors.allowed-origins:http://localhost:5173}")
    private String corsAllowedOrigins;

    public SecurityConfig(
            SurgeUserDetailsService userDetailsService,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            EdgeApiKeyAuthenticationFilter edgeApiKeyAuthenticationFilter) {
        this.userDetailsService = userDetailsService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.edgeApiKeyAuthenticationFilter = edgeApiKeyAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new LegacyAwarePasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(corsAllowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        if (origins.isEmpty()) {
            origins = List.of("http://localhost:5173");
        }
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Edge-ApiKey",
                "X-Resident-Proof", "X-Resident-Unsubscribe-Proof"));
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .userDetailsService(userDetailsService)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/public/dataset/request").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/residents/send-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/residents/verify-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/residents/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/residents/unsubscribe-otp").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/public/alerts/camera").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/public/alerts/override").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/external/weather").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/external/tides").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/sensor-data").hasRole("EDGE_INGEST")
                        .requestMatchers(HttpMethod.POST, "/api/external/sms/receive").hasRole("EDGE_INGEST")
                        .requestMatchers(HttpMethod.GET, "/api/sensor-data/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/residents/id/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/residents/*").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/residents/active").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").hasRole("HEAD_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/users").hasRole("HEAD_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/admin/users/**").hasRole("HEAD_ADMIN")
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "HEAD_ADMIN")
                        .anyRequest().denyAll()
                )
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((request, response, ex) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write("{\"error\":\"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, ex) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write("{\"error\":\"Forbidden\"}");
                        })
                );

        http.addFilterBefore(edgeApiKeyAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
