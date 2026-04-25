package com.surgealert.service;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User registerUser(Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        String fullName = request.get("fullName");

        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Username already taken");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setFullName(fullName);
        user.setRole(request.getOrDefault("role", "USER"));

        return userRepository.save(user);
    }

    public User login(String username, String password) {
        return userRepository.findByUsername(username)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()))
                .orElse(null);
    }
}