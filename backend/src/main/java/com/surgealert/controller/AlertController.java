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
        // --- UPDATE: Serve the Live Image from Memory ---
        String imgBase64 = SensorDataController.currentImageBase64;
        
        // If no image has been received yet, return empty string
        if (imgBase64 == null) {
            imgBase64 = ""; 
        }

        // Frontend will use this as <img src="data:image/jpg;base64,...">
        return ResponseEntity.ok(Collections.singletonMap("img_base64", imgBase64));
    }
}