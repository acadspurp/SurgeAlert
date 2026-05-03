package com.surgealert.service;

import com.surgealert.dto.AlertStatusDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.repository.SensorDataRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class AlertService {
    private final SensorDataRepository sensorDataRepository;

    public AlertService(SensorDataRepository sensorDataRepository) {
        this.sensorDataRepository = sensorDataRepository;
    }

    public AlertStatusDTO getCurrentAlertStatus() {
        try {
            SensorData latest = sensorDataRepository.findFirstByOrderByTimestampDesc()
                    .orElse(null);

            if (latest == null) {
                return new AlertStatusDTO(0.0, "GREEN", "No data available", LocalDateTime.now());
            }

            String description = getAlertDescription(latest.getCurrentAlertLevel());
            return new AlertStatusDTO(
                    latest.getWaterLevelM() != null ? latest.getWaterLevelM() : 0.0,
                    latest.getCurrentAlertLevel() != null ? latest.getCurrentAlertLevel() : "GREEN",
                    description,
                    latest.getTimestamp() != null ? latest.getTimestamp() : LocalDateTime.now()
            );
        } catch (Exception e) {
            return new AlertStatusDTO(0.0, "GREEN", "System initializing. No data available yet.", LocalDateTime.now());
        }
    }

    private String getAlertDescription(String alertLevel) {
        Map<String, String> descriptions = new HashMap<>();
        descriptions.put("GREEN", "NORMAL: No immediate threat. River is at a safe level.");
        descriptions.put("YELLOW", "MONITORING: Water is rising past halfway. Stay vigilant.");
        descriptions.put("ORANGE", "PREPARATION: High water level. Residents in low-lying areas should prepare.");
        descriptions.put("RED", "HIGH RISK: Dangerously high. Evacuation centers are opening. Be ready to leave.");
        descriptions.put("CRITICAL", "MANDATORY EVACUATION: River is overflowing or imminent. Leave immediately!");
        return descriptions.getOrDefault(alertLevel, "Unknown status");
    }
}