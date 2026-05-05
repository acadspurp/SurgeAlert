package com.surgealert.controller;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/public/alerts")
@CrossOrigin(origins = "*")
public class AlertController {

    public static String overrideLevel = null;

    private final SensorDataService sensorDataService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;

    public AlertController(SensorDataService sensorDataService,
            CriticalAlertApprovalService criticalAlertApprovalService) {
        this.sensorDataService = sensorDataService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
    }

    @GetMapping("/status")
    public ResponseEntity<AlertStatusDTO> getCurrentAlertStatus() {
        SensorDataDTO latestData = sensorDataService.getLatestSensorData();
        AlertStatusDTO response = new AlertStatusDTO();

        // 1. If there's an override, apply it IMMEDIATELY
        if (overrideLevel != null) {
            response.setWaterLevelM(latestData != null ? latestData.getWaterLevelM() : 0.0);
            response.setAlertLevel(overrideLevel);
            response.setLastUpdated(LocalDateTime.now());
            response.setDescription("MANUAL OVERRIDE ACTIVE.");
            return ResponseEntity.ok(response);
        }

        if (latestData != null) {
            // Online: Return actual data
            response.setWaterLevelM(latestData.getWaterLevelM());
            response.setAlertLevel(latestData.getCurrentAlertLevel());
            response.setLastUpdated(latestData.getTimestamp());
            response.setDescription("Live data from monitoring station.");
        } else {
            // Offline: Return nulls/offline status
            response.setWaterLevelM(null);
            response.setAlertLevel("OFFLINE");
            response.setLastUpdated(LocalDateTime.now());
            response.setDescription("System is currently offline.");
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/override")
    public ResponseEntity<Map<String, String>> setOverride(@RequestBody Map<String, String> body) {
        String level = body.get("level");
        if (level == null || level.trim().isEmpty() || level.equalsIgnoreCase("NORMAL")) {
            overrideLevel = null;
            UserController.addLog("Admin cleared manual override. System returned to AUTO.");
        } else {
            overrideLevel = level.toUpperCase().trim();
            UserController.addLog("Admin invoked manual override to " + overrideLevel + ".");
        }
        return ResponseEntity.ok(Collections.singletonMap("status", "success"));
    }

    @GetMapping("/camera")
    public ResponseEntity<Map<String, String>> getCameraUrl() {
        // 1. Try to get from RAM (Fastest)
        String imgBase64 = SensorDataController.currentImageBase64;

        // 2. If RAM is empty (Server restarted), try to fetch the last known image from
        // DB
        if (imgBase64 == null || imgBase64.isEmpty()) {
            SensorDataDTO latest = sensorDataService.getLatestSensorData();
            if (latest != null && latest.getSnapshotBase64() != null) {
                imgBase64 = latest.getSnapshotBase64();
                // Refill RAM cache
                SensorDataController.currentImageBase64 = imgBase64;
            }
        }

        // If still null, return empty string
        if (imgBase64 == null) {
            imgBase64 = "";
        }

        // Frontend will use this as <img src="data:image/jpg;base64,...">
        return ResponseEntity.ok(Collections.singletonMap("img_base64", imgBase64));
    }

    @GetMapping("/critical/pending/{id}")
    public ResponseEntity<?> getPendingCritical(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.getPendingAlert(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(pending);
    }

    @GetMapping("/critical/pending")
    public ResponseEntity<?> listPendingCritical() {
        return ResponseEntity.ok(criticalAlertApprovalService.listAll());
    }

    @PostMapping("/critical/pending/{id}/approve")
    public ResponseEntity<?> approveCritical(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.approve(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        UserController.addLog("Critical alert " + id + " approval set to " + pending.status() + ".");
        return ResponseEntity.ok(pending);
    }

    @PostMapping("/critical/pending/{id}/reject")
    public ResponseEntity<?> rejectCritical(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.reject(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        UserController.addLog("Critical alert " + id + " approval set to " + pending.status() + ".");
        return ResponseEntity.ok(pending);
    }
}