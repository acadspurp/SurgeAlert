package com.surgealert.controller;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.surgealert.dto.RegisterRequest;
import com.surgealert.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    // Endpoint to sync Firebase User to MySQL
    @PostMapping("/sync-user")
    public ResponseEntity<?> syncUser(@RequestHeader("Authorization") String authHeader, 
                                      @RequestBody RegisterRequest request) {
        try {
            // 1. Check for Token
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing Token");
            }
            
            String token = authHeader.substring(7);

            // 2. Verify Token with Firebase
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String firebaseUid = decodedToken.getUid();
            
            // 3. Security Check: Ensure the token email matches the request body email
            if (!decodedToken.getEmail().equals(request.getEmail())) {
                 return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Email mismatch");
            }

            // 4. Save/Update User in MySQL
            User savedUser = userService.registerUser(request, firebaseUid);
            return ResponseEntity.ok(savedUser); // Return the whole user object (including Role)

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Error: " + e.getMessage());
        }
    }
}