package com.surgealert.controller;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sensor-data")
@CrossOrigin(origins = "*")
public class SensorDataController {
    private final SensorDataService sensorDataService;

    public SensorDataController(SensorDataService sensorDataService) {
        this.sensorDataService = sensorDataService;
    }

    @PostMapping
    public ResponseEntity<SensorDataDTO> saveSensorData(@RequestBody SensorDataDTO dto) {
        sensorDataService.saveSensorData(dto);
        return ResponseEntity.ok(dto);
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