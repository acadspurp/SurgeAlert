package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.repository.SensorDataRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private final SensorDataRepository sensorDataRepository;

    // Reads from application.properties → surgealert.sensor.depth-m → SENSOR_DEPTH_M in .env
    @Value("${surgealert.sensor.depth-m:6.1}")
    private double sensorDepthM;

    // REMOVED IS_AQUARIUM_MODE to prevent logic conflict with Edge System.
    // We now strictly trust the Edge system's judgment.

    public SensorDataService(SensorDataRepository sensorDataRepository) {
        this.sensorDataRepository = sensorDataRepository;
    }

    public SensorData saveSensorData(SensorDataDTO dto) {
        // --- DATA GUARD: REJECT GHOST VALUES / NOISE ---
        // Typical ultrasonic sensor noise (like 0.17m, 0.10m) is blocked.
        // Anything below 0.30m in a river context is likely an erroneous reading or sensor floor.
        if (dto.getWaterLevelM() != null && dto.getWaterLevelM() < 0.30) {
            System.out.println(" [DATA GUARD] Blocking ghost value: " + dto.getWaterLevelM() + "m");
            return null; 
        }

        SensorData sensorData = new SensorData();

        // Set Basic Data
        sensorData.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());
        sensorData.setWaterLevelM(dto.getWaterLevelM());
        sensorData.setSensorFlowRateMps(dto.getSensorFlowRateMps());
        sensorData.setImageFlowRateMps(dto.getImageFlowRateMps());
        sensorData.setImageRiseRateMps(dto.getImageRiseRateMps());

        // --- 1. ALERT LEVEL LOGIC (TRUST THE EDGE) ---
        // If hardware (Edge) sends a status, use it explicitly.
        String alertLevel = dto.getCurrentAlertLevel();
        
        if (alertLevel == null || alertLevel.isEmpty()) {
            // Only calculate as a fallback if Edge sent nothing
            alertLevel = calculateFallbackAlertLevel(dto.getWaterLevelM());
        }
        sensorData.setCurrentAlertLevel(alertLevel.toUpperCase());

        // --- 2. PREDICTION DATA LOGIC (TRUST THE EDGE) ---
        if (dto.getPredictedLevel() != null) {
            sensorData.setPredictedLevel(dto.getPredictedLevel());
        } else {
            // Fallback to current level if AI failed
            sensorData.setPredictedLevel(dto.getWaterLevelM());
        }

        // Trust Edge's predicted alert level
        String predictedAlert = dto.getPredictedAlertLevel();
        if (predictedAlert != null && !predictedAlert.isEmpty()) {
            sensorData.setPredictedAlertLevel(predictedAlert);
        } else {
            // Fallback calculation
            sensorData.setPredictedAlertLevel(calculateFallbackAlertLevel(sensorData.getPredictedLevel()));
        }
        
        // Note: The image (SnapshotBase64) is not saved to the DB entity here 
        // because the SensorData entity doesn't usually store the full image string 
        // to keep the DB light. It is handled in memory by the Controller.
        
        return sensorDataRepository.save(sensorData);
    }

    public SensorDataDTO getLatestSensorData() {
        return sensorDataRepository.findFirstByWaterLevelMGreaterThanEqualOrderByTimestampDesc(0.30)
                .map(this::convertToDTO)
                .orElse(null);
    }

    public List<SensorDataDTO> getRecentSensorData(int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return sensorDataRepository.findRecentData(since).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private SensorDataDTO convertToDTO(SensorData sensorData) {
        SensorDataDTO dto = new SensorDataDTO();
        dto.setId(sensorData.getId());
        dto.setTimestamp(sensorData.getTimestamp());
        dto.setWaterLevelM(sensorData.getWaterLevelM());
        dto.setSensorFlowRateMps(sensorData.getSensorFlowRateMps());
        dto.setImageFlowRateMps(sensorData.getImageFlowRateMps());
        dto.setImageRiseRateMps(sensorData.getImageRiseRateMps());
        dto.setCurrentAlertLevel(sensorData.getCurrentAlertLevel());

        // Return Prediction Data
        dto.setPredictedLevel(sensorData.getPredictedLevel());
        dto.setPredictedAlertLevel(sensorData.getPredictedAlertLevel());

        return dto;
    }

    // Fallback alert classifier — used only when the Edge system is offline.
    // Thresholds are derived from sensorDepthM which comes from SENSOR_DEPTH_M in .env.
    // Mirrors the ratios in: EdgeSystem/config/settings.py and ConfigController.java
    private String calculateFallbackAlertLevel(Double waterLevel) {
        if (waterLevel == null) return "GREEN";
        if (waterLevel >= sensorDepthM * 0.90) return "RED";    // ~5.49 m at 6.1 m depth
        if (waterLevel >= sensorDepthM * 0.74) return "ORANGE"; // ~4.51 m
        if (waterLevel >= sensorDepthM * 0.57) return "YELLOW"; // ~3.48 m
        return "GREEN";
    }
}