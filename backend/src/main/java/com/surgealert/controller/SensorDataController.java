package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.service.EmailService; //import
import com.surgealert.service.NotificationService;
import com.surgealert.service.ResidentService;
import com.surgealert.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sensor-data")
@CrossOrigin(origins = "*")
public class SensorDataController {

    private final SensorDataService sensorDataService;
    private final NotificationService notificationService;
    private final ResidentService residentService;
    private final EmailService emailService;

    public SensorDataController(SensorDataService sensorDataService,
                                NotificationService notificationService,
                                ResidentService residentService,
                                EmailService emailService) {
        this.sensorDataService = sensorDataService;
        this.notificationService = notificationService;
        this.residentService = residentService;
        this.emailService = emailService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> saveSensorData(@RequestBody SensorDataDTO dto) {
        // 1. Save Data
        SensorData savedData = sensorDataService.saveSensorData(dto);

        Map<String, Object> response = new HashMap<>();
        response.put("saved_id", savedData.getId());
        response.put("status", "success");

        // 2. Check Logic
        String level = savedData.getCurrentAlertLevel();
        
        // Get the message template (e.g., "SurgeAlert: RED ALERT...")
        String messageToSend = notificationService.getAlertMessage(level);

        // --- CRITICAL CHANGE HERE ---
        // We ONLY send alerts if the level is YELLOW, ORANGE, or RED.
        // We REMOVED "GREEN" to prevent spamming users when the river is safe.
        if (messageToSend != null && (level.equals("YELLOW") || level.equals("ORANGE") || level.equals("RED"))) {
            
            // --- A. EMAIL (Server Side) ---
            List<String> emails = residentService.getAllActiveEmails();
            if (!emails.isEmpty()) {
                String subject = "SurgeAlert: " + level + " LEVEL WARNING";
                for (String email : emails) {
                    emailService.sendAlertEmail(email, subject, messageToSend);
                }
            }

            // --- B. SMS (Hardware Side) ---
            List<String> phoneNumbers = residentService.getAllActivePhoneNumbers();
            if (!phoneNumbers.isEmpty()) {
                response.put("command", "SEND_SMS");
                response.put("message", messageToSend);
                response.put("recipients", phoneNumbers);
            } else {
                response.put("command", "NO_RECIPIENTS");
            }

        } else {
            // If it is GREEN (Safe), we do nothing.
            response.put("command", "NO_ACTION");
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/latest")
    public ResponseEntity<SensorDataDTO> getLatestSensorData() {
        SensorDataDTO latest = sensorDataService.getLatestSensorData();
        if (latest == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(latest);
    }

    @GetMapping("/recent")
    public ResponseEntity<?> getRecentSensorData(@RequestParam(defaultValue = "24") int hours) {
        return ResponseEntity.ok(sensorDataService.getRecentSensorData(hours));
    }
}