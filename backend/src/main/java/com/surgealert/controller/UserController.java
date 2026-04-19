package com.surgealert.controller;

import com.surgealert.dto.UserResponse;
import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import com.surgealert.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;

    public static List<Map<String, String>> actionLogs = new ArrayList<>();

    public UserController(UserRepository userRepository, UserService userService) {
        this.userRepository = userRepository;
        this.userService = userService;
        if (actionLogs.isEmpty()) {
            addLog("System initialized.");
        }
    }

    public static void addLog(String message) {
        actionLogs.add(0, Map.of(
                "timestamp", LocalDateTime.now().toString(),
                "message", message
        ));
        if (actionLogs.size() > 100) {
            actionLogs.remove(actionLogs.size() - 1);
        }
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(
                userRepository.findAll().stream().map(UserResponse::fromEntity).collect(Collectors.toList())
        );
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(Authentication authentication, @RequestBody User user) {
        boolean head = isHeadAdmin(authentication);
        User saved = userService.createAdminUser(user, head);
        addLog("Admin created new user: " + user.getUsername());
        return ResponseEntity.ok(UserResponse.fromEntity(saved));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserResponse> updateUser(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody User user) {
        boolean head = isHeadAdmin(authentication);
        User saved = userService.updateAdminUser(id, user, head);
        addLog("Admin updated user: " + saved.getUsername() + " to role " + saved.getRole());
        return ResponseEntity.ok(UserResponse.fromEntity(saved));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        User existing = userRepository.findById(id).orElseThrow();
        userRepository.deleteById(id);
        addLog("Admin deleted user: " + existing.getUsername());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, String>>> getLogs() {
        return ResponseEntity.ok(actionLogs);
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
