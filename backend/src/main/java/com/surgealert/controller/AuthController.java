package com.surgealert.controller;

import com.surgealert.entity.User;
import com.surgealert.security.SessionTokenService;
import com.surgealert.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Critical for frontend connection
public class AuthController {

    private final UserService userService;
    private final SessionTokenService sessionTokenService;

    public AuthController(UserService userService, SessionTokenService sessionTokenService) {
        this.userService = userService;
        this.sessionTokenService = sessionTokenService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        User user = userService.login(username, password);

        if (user != null) {
            SessionTokenService.TokenPair tokenPair = sessionTokenService.issueTokens(user.getId(), user.getUsername(), user.getRole());
            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "username", user.getUsername(),
                    "fullName", user.getFullName(),
                    "role", user.getRole(),
                    "accessToken", tokenPair.accessToken(),
                    "refreshToken", tokenPair.refreshToken(),
                    "accessExpiresAt", tokenPair.accessExpiresAt(),
                    "refreshesRemaining", tokenPair.refreshesRemaining()
            ));
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> payload) {
        String refreshToken = payload.get("refreshToken");
        return sessionTokenService.refresh(refreshToken)
                .<ResponseEntity<?>>map(tokenPair -> ResponseEntity.ok(Map.of(
                        "accessToken", tokenPair.accessToken(),
                        "refreshToken", tokenPair.refreshToken(),
                        "accessExpiresAt", tokenPair.accessExpiresAt(),
                        "refreshesRemaining", tokenPair.refreshesRemaining()
                )))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Refresh denied")));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        try {
            User user = userService.registerUser(payload);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }
}