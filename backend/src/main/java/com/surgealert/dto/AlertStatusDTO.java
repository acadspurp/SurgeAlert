package com.surgealert.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public class AlertStatusDTO {
    @JsonProperty("water_level")
    private Double waterLevelM;
    private String alertLevel;
    /** Live Pi/MQTT alert before override is applied. */
    @JsonProperty("sensor_alert_level")
    private String sensorAlertLevel;
    private boolean manualOverrideActive;
    private String description;
    @JsonProperty("last_updated")
    @JsonFormat(pattern = "yyyy-MM-dd['T'][' ']HH:mm:ss")
    private LocalDateTime lastUpdated;
    @JsonProperty("sensor_flow_rate")
    private Double sensorFlowRate;
    @JsonProperty("predicted_level")
    private Double predictedLevel;
    @JsonProperty("predicted_alert_level")
    private String predictedAlertLevel;

    public AlertStatusDTO() {}

    public AlertStatusDTO(Double waterLevelM, String alertLevel, String description, LocalDateTime lastUpdated) {
        this.waterLevelM = waterLevelM;
        this.alertLevel = alertLevel;
        this.description = description;
        this.lastUpdated = lastUpdated;
    }

    public Double getWaterLevelM() { return waterLevelM; }
    public void setWaterLevelM(Double waterLevelM) { this.waterLevelM = waterLevelM; }

    public String getAlertLevel() { return alertLevel; }
    public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }

    public String getSensorAlertLevel() { return sensorAlertLevel; }
    public void setSensorAlertLevel(String sensorAlertLevel) { this.sensorAlertLevel = sensorAlertLevel; }

    public boolean isManualOverrideActive() { return manualOverrideActive; }
    public void setManualOverrideActive(boolean manualOverrideActive) { this.manualOverrideActive = manualOverrideActive; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }

    public Double getSensorFlowRate() { return sensorFlowRate; }
    public void setSensorFlowRate(Double sensorFlowRate) { this.sensorFlowRate = sensorFlowRate; }

    public Double getPredictedLevel() { return predictedLevel; }
    public void setPredictedLevel(Double predictedLevel) { this.predictedLevel = predictedLevel; }

    public String getPredictedAlertLevel() { return predictedAlertLevel; }
    public void setPredictedAlertLevel(String predictedAlertLevel) { this.predictedAlertLevel = predictedAlertLevel; }
}