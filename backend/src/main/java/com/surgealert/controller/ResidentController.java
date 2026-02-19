package com.surgealert.controller;

import com.surgealert.dto.ResidentAdminDTO;
import com.surgealert.dto.ResidentRequest;
import com.surgealert.service.ResidentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/residents")
@CrossOrigin(origins = "*")
public class ResidentController {

    private final ResidentService residentService;

    public ResidentController(ResidentService residentService) {
        this.residentService = residentService;
    }

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> payload) {
        String phone = payload.get("phoneNumber");
        String otp = residentService.generateOtp(phone);
        // Return the OTP in JSON for "Dev Mode" so you can see it in the browser console
        return ResponseEntity.ok(Collections.singletonMap("dev_otp", otp));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> payload) {
        String phone = payload.get("phoneNumber");
        String code = payload.get("code");

        if (residentService.verifyOtp(phone, code)) {
            return ResponseEntity.ok(Collections.singletonMap("status", "verified"));
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid OTP");
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerResident(@RequestBody ResidentRequest request) {
        try {
            residentService.registerResident(request);
            return ResponseEntity.status(HttpStatus.CREATED).body("Resident registered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @DeleteMapping("/{phoneNumber}")
    public ResponseEntity<?> unregisterResident(@PathVariable String phoneNumber) {
        try {
            // Note: The phoneNumber coming from the URL might be the FULL number (if the frontend has it)
            // or the masked one. 
            // SECURITY NOTE: In a real app, you shouldn't allow deleting by phone number via URL 
            // if the admin can't see the full number. 
            // For this project, we assume the Admin knows the number or searches for it internally.
            residentService.unregisterResident(phoneNumber);
            return ResponseEntity.ok("Phone number unregistered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    // --- UPDATED to return MASKED DTO objects for Admin Dashboard ---
    @GetMapping("/active")
    public ResponseEntity<List<ResidentAdminDTO>> getActiveResidents() {
        return ResponseEntity.ok(residentService.getAllActiveResidentsForAdmin());
    }
}