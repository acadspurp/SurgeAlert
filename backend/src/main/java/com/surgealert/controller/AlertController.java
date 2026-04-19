package com.surgealert.controller;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.service.CameraImageCache;
import com.surgealert.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/public/alerts")
public class AlertController {

    public static String overrideLevel = null;

    private final SensorDataService sensorDataService;
    private final CameraImageCache cameraImageCache;

    public AlertController(SensorDataService sensorDataService, CameraImageCache cameraImageCache) {
        this.sensorDataService = sensorDataService;
        this.cameraImageCache = cameraImageCache;
    }

    @GetMapping("/status")
    public ResponseEntity<AlertStatusDTO> getCurrentAlertStatus() {
        SensorDataDTO latestData = sensorDataService.getLatestSensorData();
        AlertStatusDTO response = new AlertStatusDTO();

        if (overrideLevel != null) {
            response.setWaterLevelM(latestData != null ? latestData.getWaterLevelM() : 0.0);
            response.setAlertLevel(overrideLevel);
            response.setLastUpdated(LocalDateTime.now());
            response.setDescription("MANUAL OVERRIDE ACTIVE.");
            return ResponseEntity.ok(response);
        }

        if (latestData != null) {
            response.setWaterLevelM(latestData.getWaterLevelM());
            response.setAlertLevel(latestData.getCurrentAlertLevel());
            response.setLastUpdated(latestData.getTimestamp());
            response.setDescription("Live data from monitoring station.");
        } else {
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
        String reason = body.get("reason");
        if (level == null || level.trim().isEmpty() || level.equalsIgnoreCase("NORMAL")) {
            overrideLevel = null;
            UserController.addLog("Admin cleared manual override. System returned to AUTO.");
        } else {
            overrideLevel = level.toUpperCase().trim();
            String logMsg = "Admin invoked MANUAL OVERRIDE to " + overrideLevel;
            if (reason != null && !reason.trim().isEmpty()) {
                logMsg += " (Reason: " + reason + ")";
            }
            UserController.addLog(logMsg);
        }
        return ResponseEntity.ok(Collections.singletonMap("status", "success"));
    }

    @GetMapping("/camera")
    public ResponseEntity<Map<String, String>> getCameraUrl() {
        String imgBase64 = cameraImageCache.getLatestBase64();
        if (imgBase64 == null || imgBase64.isEmpty()) {
            SensorDataDTO latest = sensorDataService.getLatestSensorData();
            if (latest != null && latest.getSnapshotBase64() != null && !latest.getSnapshotBase64().isEmpty()) {
                imgBase64 = latest.getSnapshotBase64();
                cameraImageCache.setLatestBase64(imgBase64);
            }
        }
        if (imgBase64 == null) {
            imgBase64 = "";
        }
        return ResponseEntity.ok(Collections.singletonMap("img_base64", imgBase64));
    }
}
