package com.surgealert.controller;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.service.CriticalAlertApprovalService;
import com.surgealert.service.ManualOverrideService;
import com.surgealert.service.SensorDataService;
import com.surgealert.util.AlertLevelUtils;
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
            response.setSensorAlertLevel(AlertLevelUtils.normalize(latestData.getCurrentAlertLevel()));
            response.setLastUpdated(latestData.getTimestamp());
            response.setSensorFlowRate(latestData.getSensorFlowRate());
            response.setPredictedLevel(latestData.getPredictedLevel());
            response.setPredictedAlertLevel(AlertLevelUtils.normalize(latestData.getPredictedAlertLevel()));
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
            response.setAlertLevel(AlertLevelUtils.normalize(latestData.getCurrentAlertLevel()));
            response.setDescription("Live data from monitoring station.");
        } else {
            response.setWaterLevelM(null);
            response.setAlertLevel("OFFLINE");
            response.setLastUpdated(null);
            response.setDescription("No sensor telemetry received from Edge yet.");
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/camera")
    public ResponseEntity<Map<String, String>> getCameraUrl() {
        // Always resolve from DB so snapshots update after redeploy / multi-instance Render.
        return ResponseEntity.ok(sensorDataService.getLatestCameraFeed());
    }

    @GetMapping("/red/pending/{id}")
    public ResponseEntity<?> getPendingRedAlert(@PathVariable String id) {
        CriticalAlertApprovalService.PendingCriticalAlert pending = criticalAlertApprovalService.getPendingAlert(id);
        if (pending == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(pending);
    }

    @GetMapping("/red/pending")
    public ResponseEntity<?> listPendingRedAlerts() {
        return ResponseEntity.ok(criticalAlertApprovalService.listAll());
    }

}