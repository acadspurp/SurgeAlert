package com.surgealert.service;

import com.surgealert.dto.RegisterRequest;
import com.surgealert.entity.User;
import com.surgealert.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // This is the new method AuthController is looking for
    public User registerUser(RegisterRequest request, String firebaseUid) {
        if (userRepository.existsByEmail(request.getEmail())) {
             // Return existing user if they log in again
             return userRepository.findByEmail(request.getEmail()).orElseThrow();
        }

        User user = new User();
        user.setFirebaseUid(firebaseUid); // Saves the ID from Firebase
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        // Default to ADMIN if role is missing
        user.setRole(request.getRole() != null ? request.getRole() : "ADMIN");
        
        return userRepository.save(user);
    }
    
    public User findByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }
}