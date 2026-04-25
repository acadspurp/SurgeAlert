package com.surgealert.controller;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // Mock logs
    public static List<Map<String, String>> actionLogs = new ArrayList<>();

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/users")
    public ResponseEntity<User> createUser(@RequestBody User user) {
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        User saved = userRepository.save(user);
        saved.setPassword(null);
        addLog("Admin created a user account.");
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody User user) {
        User existing = userRepository.findById(id).orElseThrow();
        existing.setFullName(user.getFullName());
        existing.setRole(user.getRole());
        // If password is provided and not empty
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            existing.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        User saved = userRepository.save(existing);
        saved.setPassword(null);
        addLog("Admin updated a user role/profile.");
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        User existing = userRepository.findById(id).orElseThrow();
        userRepository.deleteById(id);
        addLog("Admin deleted a user account.");
        return ResponseEntity.ok().build();
    }

    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, String>>> getLogs() {
        return ResponseEntity.ok(actionLogs);
    }
}
