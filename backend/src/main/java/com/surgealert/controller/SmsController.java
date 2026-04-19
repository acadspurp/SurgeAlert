package com.surgealert.controller;

import com.surgealert.service.ResidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/external/sms")
public class SmsController {

    private final ResidentService residentService;

    public SmsController(ResidentService residentService) {
        this.residentService = residentService;
    }

    @PostMapping("/receive")
    public ResponseEntity<?> receiveSms(@RequestBody Map<String, String> payload) {
        String sender = payload.get("sender");
        String message = payload.get("message");

        if (sender == null || message == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing sender or message"));
        }

        if (message.trim().equalsIgnoreCase("STOP")) {
            boolean success = residentService.unregisterResidentByPhoneSilently(sender);

            if (success) {
                return ResponseEntity.ok(Map.of(
                        "command", "SEND_SMS",
                        "recipients", new String[]{sender},
                        "message", "You will now stop receiving SMS alerts from SurgeAlert."
                ));
            }
            return ResponseEntity.ok(Map.of("status", "ignored", "reason", "Number not found"));
        }

        return ResponseEntity.ok(Map.of("status", "received"));
    }
}
