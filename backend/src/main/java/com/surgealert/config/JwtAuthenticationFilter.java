package com.surgealert.config;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    public JwtAuthenticationFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            // 1. Verify Token with Firebase
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decodedToken.getUid();
            String email = decodedToken.getEmail();

            // 2. Check if user exists in our MySQL DB
            Optional<User> userOptional = userRepository.findByFirebaseUid(uid);
            
            // Default role is USER, but if found in DB use that role
            String role = "USER";
            if (userOptional.isPresent()) {
                role = userOptional.get().getRole();
            }

            // 3. Set Spring Security Context
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userOptional.orElse(null), // Principal (User object or null)
                    null,
                    Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
            );

            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);

        } catch (Exception e) {
            // Token is invalid or expired
            System.err.println("Firebase Token Verification Failed: " + e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}