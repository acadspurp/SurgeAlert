package com.surgealert.controller;

import com.surgealert.dto.ResidentRequest;
import com.surgealert.service.NotificationService;
import com.surgealert.service.OtpDeliveryService;
import com.surgealert.service.ResidentService;
import com.surgealert.util.PhilippinePhoneUtil;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${surgealert.otp.strict-verification:true}")
    private boolean strictOtpVerification;

    public ResidentController(ResidentService residentService, NotificationService notificationService,
            OtpDeliveryService otpDeliveryService, com.surgealert.service.MqttSubscriberService mqttSubscriberService) {
        this.residentService = residentService;
        this.notificationService = notificationService;
        this.otpDeliveryService = otpDeliveryService;
        this.mqttSubscriberService = mqttSubscriberService;
    }

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> payload) {
        String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(payload.get("phoneNumber"));
        if (tenDigit == null) {
            return ResponseEntity.badRequest().body("Invalid Philippine mobile number");
        }
        System.out.println(" [OTP] send-otp requested for ***" + tenDigit.substring(Math.max(0, tenDigit.length() - 4)));
        String otp = residentService.generateOtp(tenDigit);
        String otpMessage = notificationService.getOtpMessage(otp);
        OtpDeliveryService.DeliveryResult delivery = otpDeliveryService.deliverOtp(tenDigit, otpMessage);
        System.out.println(" [OTP] delivery channel=" + delivery.channel() + " status=" + delivery.status());

        if ("INVALID_PHONE".equals(delivery.status())) {
            return ResponseEntity.badRequest().body(delivery.detail());
        }

        if ("GSM_FALLBACK".equals(delivery.channel())) {
            if (!mqttSubscriberService.isMqttConnected()) {
                System.err.println(" [OTP] GSM path blocked: backend MQTT is not connected.");
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                        "SMS could not be sent: server MQTT is offline. Start the backend or check HiveMQ credentials.");
            }
            boolean published = mqttSubscriberService.publishSmsToGsm(tenDigit, otpMessage, "otp");
            if (!published) {
                System.err.println(" [OTP] MQTT publish to Pi failed — check HiveMQ ACL and broker URL.");
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                        "SMS could not be queued: MQTT publish failed. Check backend MQTT logs.");
            }
            System.out.println(" [OTP] MQTT message queued for Pi GSM on topic surgealert/outbound/sms");
            String detail = "OTP queued to the station GSM modem — you should receive it within a few seconds.";
            return ResponseEntity.ok(Map.of(
                    "status", "OTP_ISSUED",
                    "deliveryChannel", "GSM_FALLBACK",
                    "detail", detail));
        }

        return ResponseEntity.ok(Map.of(
                "status", "OTP_ISSUED",
                "deliveryChannel", delivery.channel(),
                "detail", delivery.detail()
        ));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> payload) {
        String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(payload.get("phoneNumber"));
        if (tenDigit == null) {
            return ResponseEntity.badRequest().body("Invalid Philippine mobile number");
        }
        String code = payload.get("code");
        if (residentService.verifyOtp(tenDigit, code, true)) {
            return ResponseEntity.ok(Collections.singletonMap("status", "verified"));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid or expired OTP");
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerResident(@RequestBody ResidentRequest request) {
        try {
            String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(request.getPhoneNumber());
            if (tenDigit == null) {
                return ResponseEntity.badRequest().body("Invalid Philippine mobile number");
            }
            request.setPhoneNumber(tenDigit);

            if (strictOtpVerification && !residentService.isVerifiedForRegistration(tenDigit)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("OTP verification required before registration");
            }

            return completeRegistration(request, tenDigit, true);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /** Admin subscriber list: no OTP; requires ADMIN or HEAD_ADMIN (see SecurityConfig). */
    @PostMapping("/admin/register")
    public ResponseEntity<?> registerResidentAsAdmin(@RequestBody ResidentRequest request) {
        try {
            String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(request.getPhoneNumber());
            if (tenDigit == null) {
                return ResponseEntity.badRequest().body("Invalid Philippine mobile number");
            }
            request.setPhoneNumber(tenDigit);
            return completeRegistration(request, tenDigit, false);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    private ResponseEntity<?> completeRegistration(
            ResidentRequest request, String tenDigit, boolean consumeOtpVerification) {
        residentService.registerResident(request);
        if (consumeOtpVerification) {
            residentService.consumeRegistrationVerification(tenDigit);
        }

        String successMsg = notificationService.getRegistrationSuccessMessage();
        OtpDeliveryService.DeliveryResult delivery = otpDeliveryService.deliverOtp(tenDigit, successMsg);
        if ("GSM_FALLBACK".equals(delivery.channel())) {
            mqttSubscriberService.publishSmsToGsm(tenDigit, successMsg, "alert");
        }

        return ResponseEntity.status(HttpStatus.CREATED).body("Resident registered successfully");
    }

    @DeleteMapping("/{phoneNumber}")
    public ResponseEntity<?> unregisterResident(@PathVariable String phoneNumber) {
        try {
            String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(phoneNumber);
            if (tenDigit == null) {
                return ResponseEntity.badRequest().body("Invalid Philippine mobile number");
            }
            residentService.unregisterResident(tenDigit);
            return ResponseEntity.ok("Phone number unregistered successfully");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @PostMapping("/unsubscribe-otp")
    public ResponseEntity<?> unsubscribeOtp(@RequestBody Map<String, String> payload) {
        String tenDigit = PhilippinePhoneUtil.normalizeToTenDigit(payload.get("phoneNumber"));
        if (tenDigit == null) {
            return ResponseEntity.badRequest().body("Invalid Philippine mobile number");
        }
        String code = payload.get("code");

        if (residentService.verifyOtp(tenDigit, code, false)) {
            boolean success = residentService.unregisterResidentByPhoneSilently(tenDigit);
            if (success) {
                return ResponseEntity.ok(Collections.singletonMap("status", "unsubscribed"));
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Collections.singletonMap("error", "Phone not found anymore"));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Collections.singletonMap("error", "Invalid or expired OTP"));
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

    @PutMapping("/{id}/toggle-priority")
    public ResponseEntity<?> togglePriority(@PathVariable Long id) {
        try {
            residentService.togglePriority(id);
            return ResponseEntity.ok("Priority toggled");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @GetMapping("/active")
    public ResponseEntity<List<com.surgealert.dto.ResidentAdminDTO>> getActiveResidents() {
        return ResponseEntity.ok(residentService.getAllActiveResidentsForAdmin());
    }
}
