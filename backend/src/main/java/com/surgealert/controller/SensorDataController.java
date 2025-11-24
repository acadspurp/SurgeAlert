package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.service.EmailService;
import com.surgealert.service.NotificationService;
import com.surgealert.service.ResidentService;
import com.surgealert.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
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

    // --- LIVE IMAGE STORAGE (Held in RAM) ---
    // We keep this for speed, but we will add a fallback to the DB
    public static String currentImageBase64 = "";

    // --- SECURITY KEY (Must match Python settings.py) ---
    private static final String SECRET_API_KEY = "surge-alert-secret-123";

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
    public ResponseEntity<Map<String, Object>> saveSensorData(
            @RequestHeader(value = "X-Edge-ApiKey", required = false) String apiKey,
            @RequestBody SensorDataDTO dto) {

        // 1. SECURITY CHECK
        if (apiKey == null || !apiKey.equals(SECRET_API_KEY)) {
            System.out.println("Security Warning: Invalid API Key received.");
            return ResponseEntity.status(403).body(Map.of("error", "Unauthorized"));
        }

        // 2. Save Image to Memory (for Live Feed)
        // Also saves to DB via service if DTO has it
        if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
            currentImageBase64 = dto.getSnapshotBase64();
        }

        // 3. Save Data to Database
        SensorData savedData = sensorDataService.saveSensorData(dto);

        Map<String, Object> response = new HashMap<>();
        response.put("saved_id", savedData.getId());
        response.put("status", "success");

        // 4. Check Logic for Alerts
        String level = savedData.getCurrentAlertLevel();
        
        // Get message template
        String messageToSend = notificationService.getAlertMessage(level);

        // --- LOGIC: ONLY SEND IF YELLOW, ORANGE, OR RED ---
        // We strictly block "GREEN" here.
        boolean isCritical = level.equalsIgnoreCase("YELLOW") ||
                             level.equalsIgnoreCase("ORANGE") ||
                             level.equalsIgnoreCase("RED");

        if (isCritical && messageToSend != null) {
            // A. EMAIL (Server Side)
            List<String> emails = residentService.getAllActiveEmails();
            if (!emails.isEmpty()) {
                String subject = "SurgeAlert: " + level + " LEVEL WARNING";
                for (String email : emails) {
                    emailService.sendAlertEmail(email, subject, messageToSend, dto.getSnapshotBase64());
                }
            }

            // B. SMS Command (Tell Python to send SMS via Hardware)
            List<String> phoneNumbers = residentService.getAllActivePhoneNumbers();
            if (!phoneNumbers.isEmpty()) {
                response.put("command", "SEND_SMS");
                response.put("message", messageToSend);
                response.put("recipients", phoneNumbers);
            } else {
                response.put("command", "NO_RECIPIENTS");
            }
        } else {
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