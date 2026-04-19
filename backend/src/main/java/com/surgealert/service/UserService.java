package com.surgealert.service;

import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {

        this.userRepository = userRepository;
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
        user.setPassword(password);
        user.setFullName(fullName);
        user.setRole(request.getOrDefault("role", "USER"));

        return userRepository.save(user);
    }

    public User login(String username, String password) {
        return userRepository.findByUsername(username)
                .filter(user -> user.getPassword().equals(password))
                .orElse(null);
    }
}