package com.surgealert.controller;

import com.surgealert.dto.ResidentRequest;
import com.surgealert.entity.Resident;
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
            residentService.unregisterResident(phoneNumber);
            return ResponseEntity.ok("Phone number unregistered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }
    
    @GetMapping("/active")
    public ResponseEntity<List<String>> getActivePhoneNumbers() {
        return ResponseEntity.ok(residentService.getAllActivePhoneNumbers());
    }
}