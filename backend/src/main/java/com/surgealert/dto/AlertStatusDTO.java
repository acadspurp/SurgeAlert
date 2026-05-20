package com.surgealert.dto;

import java.time.LocalDateTime;

public class AlertStatusDTO {
    private Double waterLevelM;
    private String alertLevel;
    /** Live Pi/MQTT alert before override is applied. */
    private String sensorAlertLevel;
    private boolean manualOverrideActive;
    private String description;
    private LocalDateTime lastUpdated;

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
}