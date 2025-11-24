package com.surgealert.controller;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.dto.SensorDataDTO;
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

    private final SensorDataService sensorDataService;

    public AlertController(SensorDataService sensorDataService) {
        this.sensorDataService = sensorDataService;
    }

    @GetMapping("/status")
    public ResponseEntity<AlertStatusDTO> getCurrentAlertStatus() {
        SensorDataDTO latestData = sensorDataService.getLatestSensorData();
        AlertStatusDTO response = new AlertStatusDTO();

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

    @GetMapping("/camera")
    public ResponseEntity<Map<String, String>> getCameraUrl() {
        // 1. Try to get from RAM (Fastest)
        String imgBase64 = SensorDataController.currentImageBase64;

        // 2. If RAM is empty (Server restarted), try to fetch the last known image from DB
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
}