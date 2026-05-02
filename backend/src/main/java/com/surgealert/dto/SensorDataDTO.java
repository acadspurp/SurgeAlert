package com.surgealert.dto;

import java.time.LocalDateTime;

public class SensorDataDTO {
    private Long id;
    private LocalDateTime timestamp;
    private Double waterLevelM;
    private Double sensorFlowRateMps;
    private Double imageFlowRateMps;
    private Double imageRiseRateMps;
    private String currentAlertLevel;

    public SensorDataDTO() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Double getWaterLevelM() { return waterLevelM; }
    public void setWaterLevelM(Double waterLevelM) { this.waterLevelM = waterLevelM; }

    public Double getSensorFlowRateMps() { return sensorFlowRateMps; }
    public void setSensorFlowRateMps(Double sensorFlowRateMps) { this.sensorFlowRateMps = sensorFlowRateMps; }

    public Double getImageFlowRateMps() { return imageFlowRateMps; }
    public void setImageFlowRateMps(Double imageFlowRateMps) { this.imageFlowRateMps = imageFlowRateMps; }

    public Double getImageRiseRateMps() { return imageRiseRateMps; }
    public void setImageRiseRateMps(Double imageRiseRateMps) { this.imageRiseRateMps = imageRiseRateMps; }

    public String getCurrentAlertLevel() { return currentAlertLevel; }
    public void setCurrentAlertLevel(String currentAlertLevel) { this.currentAlertLevel = currentAlertLevel; }
}