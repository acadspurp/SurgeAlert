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
        sensorData.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());
        sensorData.setWaterLevelM(dto.getWaterLevelM());
        sensorData.setSensorFlowRateMps(dto.getSensorFlowRateMps());
        sensorData.setImageFlowRateMps(dto.getImageFlowRateMps());
        sensorData.setImageRiseRateMps(dto.getImageRiseRateMps());
        
        // LOGIC: If hardware sends status, use it. If not, calculate it here.
        String alertLevel = dto.getCurrentAlertLevel();
        if (alertLevel == null || alertLevel.isEmpty()) {
            alertLevel = calculateAlertLevel(dto.getWaterLevelM());
        }
        
        sensorData.setCurrentAlertLevel(alertLevel.toUpperCase());
        
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
        return dto;
    }

    // CENTRALIZED LOGIC FOR ALERT STATUS
    private String calculateAlertLevel(Double waterLevel) {
        if (waterLevel == null) return "GREEN";
        if (waterLevel < 15.0) return "GREEN";
        if (waterLevel >= 15.0 && waterLevel < 16.0) return "YELLOW";
        if (waterLevel >= 16.0 && waterLevel < 18.0) return "ORANGE";
        return "RED";
    }
}