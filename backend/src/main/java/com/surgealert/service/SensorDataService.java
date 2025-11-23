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
    
    // --- CONFIGURATION SWITCH ---
    // Set TRUE for 32cm Tank Test
    // Set FALSE for 10m River Deployment
    private final boolean IS_AQUARIUM_MODE = true; 

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

        // 1. ALERT LEVEL LOGIC
        // If hardware sends status, use it. If not, calculate it using Java fallback.
        String alertLevel = dto.getCurrentAlertLevel();
        if (alertLevel == null || alertLevel.isEmpty()) {
            alertLevel = calculateAlertLevel(dto.getWaterLevelM());
        }
        sensorData.setCurrentAlertLevel(alertLevel.toUpperCase());

        // 2. PREDICTION DATA LOGIC (Updated for Null Handling)
        // If AI provides a level, use it.
        // If AI is NULL (failed/loading), fallback to current Water Level so graph doesn't drop to 0.
        if (dto.getPredictedLevel() != null) {
            sensorData.setPredictedLevel(dto.getPredictedLevel());
        } else {
            sensorData.setPredictedLevel(dto.getWaterLevelM()); 
        }

        if (dto.getPredictedAlertLevel() != null) {
            sensorData.setPredictedAlertLevel(dto.getPredictedAlertLevel());
        } else {
            // Calculate alert based on the predicted level we just set
            sensorData.setPredictedAlertLevel(calculateAlertLevel(sensorData.getPredictedLevel()));
        }

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

    private String calculateAlertLevel(Double waterLevel) {
        if (waterLevel == null) return "GREEN";

        if (IS_AQUARIUM_MODE) {
            // --- AQUARIUM THRESHOLDS (0.32m Max) ---
            if (waterLevel >= 0.28) return "RED";
            if (waterLevel >= 0.22) return "ORANGE";
            if (waterLevel >= 0.15) return "YELLOW";
        } else {
            // --- RIVER THRESHOLDS (10m Max) ---
            if (waterLevel >= 9.0) return "RED";
            if (waterLevel >= 8.0) return "ORANGE";
            if (waterLevel >= 6.0) return "YELLOW";
        }
        
        return "GREEN";
    }
}