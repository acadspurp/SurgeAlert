package com.surgealert.controller;

import com.surgealert.service.ResidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/external/sms")
@CrossOrigin(origins = "*")
public class SmsController {

    private final ResidentService residentService;
    private static final String SECRET_API_KEY = System.getenv().getOrDefault("EDGE_API_KEY", "");

    public SmsController(ResidentService residentService) {
        this.residentService = residentService;
    }

    @PostMapping("/receive")
    public ResponseEntity<?> receiveSms(
            @RequestHeader(value = "X-Edge-ApiKey", required = false) String apiKey,
            @RequestBody Map<String, String> payload) {
        
        // 1. SECURITY CHECK
        if (apiKey == null || !apiKey.equals(SECRET_API_KEY)) {
            return ResponseEntity.status(403).body(Map.of("error", "Unauthorized"));
        }

        String sender = payload.get("sender");
        String message = payload.get("message");

        if (sender == null || message == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing sender or message"));
        }

        // Clean number (e.g. format to omit +63 if needed, assuming sender comes in exact format)
        // If message is EXACTLY "STOP" (case-insensitive, trimming whitespace)
        if (message.trim().equalsIgnoreCase("STOP")) {
            boolean success = residentService.unregisterResidentByPhoneSilently(sender);
            
            if (success) {
                // Returns command to the EDGE device to send a confirmation SMS back
                return ResponseEntity.ok(Map.of(
                    "command", "SEND_SMS",
                    "recipients", new String[]{sender},
                    "message", "You will now stop receiving SMS alerts from SurgeAlert."
                ));
            } else {
                return ResponseEntity.ok(Map.of("status", "ignored", "reason", "Number not found"));
            }
        }

        return ResponseEntity.ok(Map.of("status", "received"));
    }
}
