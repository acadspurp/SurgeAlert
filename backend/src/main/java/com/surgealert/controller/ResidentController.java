package com.surgealert.controller;

import com.surgealert.dto.ResidentAdminDTO;
import com.surgealert.dto.ResidentRequest;
import com.surgealert.service.NotificationService;
import com.surgealert.service.OtpDeliveryService;
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
    private final NotificationService notificationService;
    private final OtpDeliveryService otpDeliveryService;
    private final com.surgealert.service.MqttSubscriberService mqttSubscriberService;

    public ResidentController(ResidentService residentService, NotificationService notificationService,
            OtpDeliveryService otpDeliveryService, com.surgealert.service.MqttSubscriberService mqttSubscriberService) {
        this.residentService = residentService;
        this.notificationService = notificationService;
        this.otpDeliveryService = otpDeliveryService;
        this.mqttSubscriberService = mqttSubscriberService;
    }

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> payload) {
        String phone = payload.get("phoneNumber");
        String otp = residentService.generateOtp(phone);
        String otpMessage = notificationService.getOtpMessage(otp);
        OtpDeliveryService.DeliveryResult delivery = otpDeliveryService.deliverOtp(phone, otpMessage);

        if ("GSM_FALLBACK".equals(delivery.channel())) {
            mqttSubscriberService.publishSmsToGsm(phone, otpMessage);
        }

        return ResponseEntity.ok(Map.of(
                "status", "OTP_ISSUED",

                "deliveryChannel", delivery.channel(),
                "detail", delivery.detail()
        ));
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

    @PostMapping("/unsubscribe-otp")
    public ResponseEntity<?> unsubscribeOtp(@RequestBody Map<String, String> payload) {
        String phone = payload.get("phoneNumber");
        String code = payload.get("code");

        if (residentService.verifyOtp(phone, code)) {
            boolean success = residentService.unregisterResidentByPhoneSilently(phone);
            if (success) {
                return ResponseEntity.ok(Collections.singletonMap("status", "unsubscribed"));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("error", "Phone not found anymore"));
            }
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("error", "Invalid OTP"));
        }
    }

    /** Admin UI uses masked phone only; delete by database id instead. */
    @DeleteMapping("/id/{id}")
    public ResponseEntity<?> unregisterResidentById(@PathVariable Long id) {
        try {
            residentService.unregisterResidentById(id);
            return ResponseEntity.ok("Resident unregistered successfully");
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