package com.surgealert.controller;

import com.surgealert.dto.LoginResponse;
import com.surgealert.entity.User;
import com.surgealert.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");
        try {
            LoginResponse response = userService.login(username, password);
            if (response == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
            }
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }
    }

    /**
     * Creates a user account (typically ADMIN). Restricted to HEAD_ADMIN by Spring Security.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(Authentication authentication, @RequestBody Map<String, String> payload) {
        try {
            boolean head = isHeadAdmin(authentication);
            User u = new User();
            u.setUsername(payload.get("username"));
            u.setPassword(payload.get("password"));
            u.setFullName(payload.get("fullName"));
            u.setRole(payload.getOrDefault("role", "ADMIN"));
            User saved = userService.createAdminUser(u, head);
            return ResponseEntity.ok(Map.of(
                    "id", saved.getId(),
                    "username", saved.getUsername(),
                    "fullName", saved.getFullName(),
                    "role", saved.getRole()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    private static boolean isHeadAdmin(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        for (GrantedAuthority a : authentication.getAuthorities()) {
            if ("ROLE_HEAD_ADMIN".equals(a.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
