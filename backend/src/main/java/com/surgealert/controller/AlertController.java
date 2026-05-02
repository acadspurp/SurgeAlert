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
            // Online: Return actual data using correct DTO setters
            response.setWaterLevelM(latestData.getWaterLevelM());
            response.setAlertLevel(latestData.getCurrentAlertLevel());
            response.setLastUpdated(latestData.getTimestamp());
            response.setDescription("Live data from monitoring station.");
        } else {
            // Offline: Return nulls to let Frontend handle the "Offline" look
            response.setWaterLevelM(null);
            response.setAlertLevel("OFFLINE");
            response.setLastUpdated(LocalDateTime.now());
            response.setDescription("System is currently offline.");
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/camera")
    public ResponseEntity<Map<String, String>> getCameraUrl() {
        // Change this string when you connect your ESP32-Cam later
        // Leave as empty string "" to simulate Offline/No Signal
        String cameraUrl = ""; 
        return ResponseEntity.ok(Collections.singletonMap("url", cameraUrl));
    }
}