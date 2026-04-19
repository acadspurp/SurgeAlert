package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.repository.SensorDataRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private static final int MAX_RECENT_HOURS = 24 * 90;

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

        String alertLevel = dto.getCurrentAlertLevel();
        if (alertLevel == null || alertLevel.isEmpty()) {
            alertLevel = calculateFallbackAlertLevel(dto.getWaterLevelM());
        }
        sensorData.setCurrentAlertLevel(alertLevel.toUpperCase());

        if (dto.getPredictedLevel() != null) {
            sensorData.setPredictedLevel(dto.getPredictedLevel());
        } else {
            sensorData.setPredictedLevel(dto.getWaterLevelM());
        }

        String predictedAlert = dto.getPredictedAlertLevel();
        if (predictedAlert != null && !predictedAlert.isEmpty()) {
            sensorData.setPredictedAlertLevel(predictedAlert);
        } else {
            sensorData.setPredictedAlertLevel(calculateFallbackAlertLevel(sensorData.getPredictedLevel()));
        }

        if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
            sensorData.setSnapshotBase64(dto.getSnapshotBase64());
        }

        return sensorDataRepository.save(sensorData);
    }

    public SensorDataDTO getLatestSensorData() {
        return sensorDataRepository.findFirstByOrderByTimestampDesc()
                .map(this::convertToDTO)
                .orElse(null);
    }

    public List<SensorDataDTO> getRecentSensorData(int hours) {
        int h = Math.max(1, Math.min(hours, MAX_RECENT_HOURS));
        LocalDateTime since = LocalDateTime.now().minusHours(h);
        return sensorDataRepository.findRecentData(since).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<SensorDataDTO> getSensorDataForExport(LocalDateTime start, LocalDateTime end, int maxRows) {
        var page = PageRequest.of(0, Math.max(1, maxRows));
        return sensorDataRepository.findByTimestampBetweenOrderByTimestampAsc(start, end, page).getContent().stream()
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
        dto.setPredictedLevel(sensorData.getPredictedLevel());
        dto.setPredictedAlertLevel(sensorData.getPredictedAlertLevel());
        dto.setSnapshotBase64(sensorData.getSnapshotBase64());
        return dto;
    }

    private String calculateFallbackAlertLevel(Double waterLevel) {
        if (waterLevel == null) {
            return "GREEN";
        }
        if (waterLevel >= 8.5) {
            return "RED";
        }
        if (waterLevel >= 7.0) {
            return "ORANGE";
        }
        if (waterLevel >= 6.0) {
            return "YELLOW";
        }
        return "GREEN";
    }
}
