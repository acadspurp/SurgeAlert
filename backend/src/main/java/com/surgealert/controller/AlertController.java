package com.surgealert.controller;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.ManualOverrideService;
import com.surgealert.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/public/alerts")
@CrossOrigin(origins = "*")
public class AlertController {
    private final SensorDataService sensorDataService;
    private final CriticalAlertApprovalService criticalAlertApprovalService;
    private final ManualOverrideService manualOverrideService;

    public AlertController(SensorDataService sensorDataService,
            CriticalAlertApprovalService criticalAlertApprovalService,
            ManualOverrideService manualOverrideService) {
        this.sensorDataService = sensorDataService;
        this.criticalAlertApprovalService = criticalAlertApprovalService;
        this.manualOverrideService = manualOverrideService;
    }

    @GetMapping("/status")
    public ResponseEntity<AlertStatusDTO> getCurrentAlertStatus() {
        SensorDataDTO latestData = sensorDataService.getLatestSensorData();
        AlertStatusDTO response = new AlertStatusDTO();

        if (latestData != null) {
            response.setWaterLevelM(latestData.getWaterLevelM());
            response.setSensorAlertLevel(latestData.getCurrentAlertLevel());
            response.setLastUpdated(latestData.getTimestamp());
        }

        String overrideLevel = manualOverrideService.getOverrideLevel().orElse(null);
        if (overrideLevel != null) {
            response.setManualOverrideActive(true);
            response.setAlertLevel(overrideLevel);
            // Do not stamp lastUpdated with "now" — that falsely marks hardware as online.
            response.setDescription("MANUAL OVERRIDE ACTIVE.");
            return ResponseEntity.ok(response);
        }

        if (latestData != null) {
            response.setAlertLevel(latestData.getCurrentAlertLevel());
            response.setDescription("Live data from monitoring station.");
        } else {
            response.setWaterLevelM(null);
            response.setAlertLevel("OFFLINE");
            response.setLastUpdated(null);
            response.setDescription("No sensor telemetry received from Edge yet.");
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/override")
    public ResponseEntity<Map<String, String>> setOverride(@RequestBody Map<String, String> body) {
        String level = body.get("level");
        if (level == null || level.trim().isEmpty() || level.equalsIgnoreCase("NORMAL")) {
            manualOverrideService.clearOverride();
            UserController.addLog("Admin cleared manual override. System returned to AUTO.");
        } else {
            String normalized = level.toUpperCase().trim();
            manualOverrideService.setOverrideLevel(normalized);
            UserController.addLog("Admin invoked manual override to " + normalized + ".");
        }
        return ResponseEntity.ok(Collections.singletonMap("status", "success"));
    }

    @GetMapping("/camera")
    public ResponseEntity<Map<String, String>> getCameraUrl() {
        // Always resolve from DB so snapshots update after redeploy / multi-instance Render.
        return ResponseEntity.ok(sensorDataService.getLatestCameraFeed());
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