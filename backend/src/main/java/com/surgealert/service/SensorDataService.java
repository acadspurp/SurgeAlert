package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.repository.SensorDataRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private final SensorDataRepository sensorDataRepository;

    // REMOVED IS_AQUARIUM_MODE to prevent logic conflict with Edge System.
    // We now strictly trust the Edge system's judgment.

    public SensorDataService(SensorDataRepository sensorDataRepository) {
        this.sensorDataRepository = sensorDataRepository;
    }

    public SensorData saveSensorData(SensorDataDTO dto) {
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
        return sensorDataRepository.findFirstByOrderByTimestampDesc()
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

    // This is now only a FALLBACK method.
    // Real thresholds should be managed in Python (EdgeSystem/config/settings.py)
    private String calculateFallbackAlertLevel(Double waterLevel) {
        if (waterLevel == null) return "GREEN";
        
        // Default safe fallbacks if Edge logic fails completely
        if (waterLevel >= 8.5) return "RED";
        if (waterLevel >= 7.0) return "ORANGE";
        if (waterLevel >= 6.0) return "YELLOW";

        return "GREEN";
    }
}