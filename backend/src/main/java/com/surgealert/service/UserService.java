package com.surgealert.service;

import com.surgealert.dto.LoginResponse;
import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import com.surgealert.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    /**
     * Self-service registration disabled for roles: always creates USER.
     * Use admin APIs to create ADMIN accounts.
     */
    @Transactional
    public User registerUser(Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        String fullName = request.get("fullName");

        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        if (userRepository.existsByUsername(username)) {
            throw new IllegalStateException("Username already taken");
        }

        User user = new User();
        user.setUsername(username.trim());
        user.setPassword(passwordEncoder.encode(password));
        user.setFullName(fullName != null ? fullName : username);
        user.setRole("USER");
        return userRepository.save(user);
    }

    @Transactional
    public User createAdminUser(User incoming, boolean callerIsHeadAdmin) {
        if (incoming.getUsername() == null || incoming.getUsername().isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (incoming.getPassword() == null || incoming.getPassword().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        if (userRepository.existsByUsername(incoming.getUsername())) {
            throw new IllegalStateException("Username already taken");
        }
        String role = incoming.getRole() == null ? "ADMIN" : incoming.getRole().toUpperCase();
        if ("HEAD_ADMIN".equals(role) && !callerIsHeadAdmin) {
            throw new SecurityException("Only HEAD_ADMIN can create HEAD_ADMIN users");
        }
        if (!callerIsHeadAdmin && !"ADMIN".equals(role) && !"USER".equals(role)) {
            throw new SecurityException("Insufficient privileges for this role assignment");
        }

        User user = new User();
        user.setUsername(incoming.getUsername().trim());
        user.setPassword(passwordEncoder.encode(incoming.getPassword()));
        user.setFullName(incoming.getFullName() != null ? incoming.getFullName() : incoming.getUsername());
        user.setRole(role);
        return userRepository.save(user);
    }

    @Transactional
    public User updateAdminUser(Long id, User patch, boolean callerIsHeadAdmin) {
        User existing = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!callerIsHeadAdmin && "HEAD_ADMIN".equalsIgnoreCase(existing.getRole())) {
            throw new SecurityException("Only HEAD_ADMIN can modify HEAD_ADMIN accounts");
        }
        if (patch.getFullName() != null && !patch.getFullName().isBlank()) {
            existing.setFullName(patch.getFullName());
        }
        if (patch.getRole() != null && !patch.getRole().isBlank()) {
            String newRole = patch.getRole().toUpperCase();
            if ("HEAD_ADMIN".equals(newRole) && !callerIsHeadAdmin) {
                throw new SecurityException("Only HEAD_ADMIN can assign HEAD_ADMIN role");
            }
            if (!callerIsHeadAdmin && "HEAD_ADMIN".equalsIgnoreCase(existing.getRole())) {
                throw new SecurityException("Cannot change role of HEAD_ADMIN");
            }
            existing.setRole(newRole);
        }
        if (patch.getPassword() != null && !patch.getPassword().isEmpty()) {
            if (patch.getPassword().length() < 8) {
                throw new IllegalArgumentException("Password must be at least 8 characters");
            }
            existing.setPassword(passwordEncoder.encode(patch.getPassword()));
        }
        return userRepository.save(existing);
    }

    public LoginResponse login(String username, String password) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password));

        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return null;
        }
        String stored = user.getPassword();
        if (stored != null && !stored.startsWith("$2")) {
            user.setPassword(passwordEncoder.encode(password));
            userRepository.save(user);
        }

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole());
        claims.put("uid", user.getId());
        String token = jwtService.generateToken(user.getUsername(), claims);
        return new LoginResponse(token, user.getId(), user.getUsername(), user.getFullName(), user.getRole());
    }
}
