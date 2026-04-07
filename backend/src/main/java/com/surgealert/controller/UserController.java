package com.surgealert.controller;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
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

    // Mock logs
    public static List<Map<String, String>> actionLogs = new ArrayList<>();

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
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
        User saved = userRepository.save(user);
        addLog("Admin created new user: " + user.getUsername());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody User user) {
        User existing = userRepository.findById(id).orElseThrow();
        existing.setFullName(user.getFullName());
        existing.setRole(user.getRole());
        // If password is provided and not empty
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            existing.setPassword(user.getPassword());
        }
        User saved = userRepository.save(existing);
        addLog("Admin updated user: " + existing.getUsername() + " to role " + existing.getRole());
        return ResponseEntity.ok(saved);
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
}
