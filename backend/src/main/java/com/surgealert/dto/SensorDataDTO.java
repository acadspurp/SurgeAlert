package com.surgealert.dto;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

public class SensorDataDTO {

    private Long id;
    private LocalDateTime timestamp;

    // Raw Sensor Data
    private Double waterLevelM;
    private Double sensorFlowRateMps;
    
    // Computer Vision Data
    private Double imageFlowRateMps;
    private Double imageRiseRateMps;
    
    // Status
    private String currentAlertLevel;
    
    // --- NEW FIELDS FOR AI PREDICTION ---
    private Double predictedLevel;
    private String predictedAlertLevel;

    // Image
    private String snapshotBase64;

    public SensorDataDTO() {}

    // --- Getters and Setters ---

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

    // --- NEW GETTERS/SETTERS FOR PREDICTION ---
    public Double getPredictedLevel() { return predictedLevel; }
    public void setPredictedLevel(Double predictedLevel) { this.predictedLevel = predictedLevel; }

    public String getPredictedAlertLevel() { return predictedAlertLevel; }
    public void setPredictedAlertLevel(String predictedAlertLevel) { this.predictedAlertLevel = predictedAlertLevel; }

    public String getSnapshotBase64() { return snapshotBase64; }
    public void setSnapshotBase64(String snapshotBase64) { this.snapshotBase64 = snapshotBase64; }
}