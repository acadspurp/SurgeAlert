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

    public SensorDataService(SensorDataRepository sensorDataRepository) {
        this.sensorDataRepository = sensorDataRepository;
    }

    public SensorData saveSensorData(SensorDataDTO dto) {
        SensorData sensorData = new SensorData();
        
        // Set Timestamp (Use Server time if DTO time is missing)
        sensorData.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());
        
        // Map sensor readings
        sensorData.setWaterLevelM(dto.getWaterLevelM());
        sensorData.setSensorFlowRateMps(dto.getSensorFlowRateMps());
        sensorData.setImageFlowRateMps(dto.getImageFlowRateMps());
        sensorData.setImageRiseRateMps(dto.getImageRiseRateMps());

        // --- LOGIC FIX FOR AQUARIUM VS RIVER ---
        // We prioritize the Alert Level calculated by the Python Edge device.
        // Python knows if it's in "AQUARIUM" or "RIVER" mode. 
        String alertLevel = dto.getCurrentAlertLevel();

        if (alertLevel != null && !alertLevel.isEmpty()) {
            // 1. Trust the Edge Device
            sensorData.setCurrentAlertLevel(alertLevel.toUpperCase());
        } else {
            // 2. Fallback: If Python didn't send a level, calculate it here.
            // NOTE: This fallback logic assumes RIVER scale (3.5m+). 
            // If testing in Aquarium without Python logic, this might default to GREEN.
            String calculatedLevel = calculateAlertLevelFallback(dto.getWaterLevelM());
            sensorData.setCurrentAlertLevel(calculatedLevel);
        }

        return sensorDataRepository.save(sensorData);
    }

    public SensorDataDTO getLatestSensorData() {
        return sensorDataRepository.findFirstByOrderByTimestampDesc()
                .map(this::convertToDTO)
                .orElse(null); // Returns null if no data exists (Offline state)
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
        
        // Note: We do not send back the base64 image here to keep response light
        // The image is usually accessed via a separate Endpoint if needed
        return dto;
    }

    // CENTRALIZED LOGIC FOR ALERT STATUS (FALLBACK ONLY)
    private String calculateAlertLevelFallback(Double waterLevel) {
        if (waterLevel == null) return "GREEN";
        
        // Default River Thresholds (Tullahan estimation)
        // This is only used if Python fails to calculate logic
        if (waterLevel < 15.0) return "GREEN"; 
        if (waterLevel >= 15.0 && waterLevel < 16.0) return "YELLOW";
        if (waterLevel >= 16.0 && waterLevel < 18.0) return "ORANGE";
        return "RED";
    }
}