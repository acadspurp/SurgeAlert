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
public class ResidentController {

    public static final String HEADER_REGISTRATION_PROOF = "X-Resident-Proof";
    public static final String HEADER_UNSUBSCRIBE_PROOF = "X-Resident-Unsubscribe-Proof";

    private final ResidentService residentService;

    public ResidentController(ResidentService residentService) {
        this.residentService = residentService;
    }

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> payload) {
        try {
            String phone = payload.get("phoneNumber");
            return ResponseEntity.ok(residentService.generateOtp(phone));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(e.getMessage() != null ? e.getMessage() : "Too many requests");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error sending OTP");
        }
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> payload) {
        try {
            String phone = payload.get("phoneNumber");
            String code = payload.get("code");
            String purpose = payload.getOrDefault("purpose", "REGISTER");
            return ResponseEntity.ok(residentService.verifyOtp(phone, code, purpose));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerResident(
            @RequestHeader(HEADER_REGISTRATION_PROOF) String registrationToken,
            @RequestBody ResidentRequest request) {
        try {
            residentService.registerResident(request, registrationToken);
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

    @PostMapping("/unsubscribe-otp")
    public ResponseEntity<?> unsubscribeOtp(
            @RequestHeader(HEADER_UNSUBSCRIBE_PROOF) String unsubscribeToken,
            @RequestBody Map<String, String> payload) {
        try {
            String phone = payload.get("phoneNumber");
            boolean success = residentService.completeUnsubscribeWithProof(phone, unsubscribeToken);
            if (success) {
                return ResponseEntity.ok(Collections.singletonMap("status", "unsubscribed"));
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("error", "Phone not found"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @DeleteMapping("/id/{id}")
    public ResponseEntity<?> unregisterResidentById(@PathVariable Long id) {
        try {
            residentService.unregisterResidentById(id);
            return ResponseEntity.ok("Resident unregistered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @GetMapping("/active")
    public ResponseEntity<List<ResidentAdminDTO>> getActiveResidents() {
        return ResponseEntity.ok(residentService.getAllActiveResidentsForAdmin());
    }
}
