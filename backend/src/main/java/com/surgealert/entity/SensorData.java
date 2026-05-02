package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sensor_data")
public class SensorData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private Double waterLevelM;

    @Column(nullable = false)
    private Double sensorFlowRateMps;

    @Column(nullable = false)
    private Double imageFlowRateMps;

    @Column(nullable = false)
    private Double imageRiseRateMps;

    @Column(nullable = false)
    private String currentAlertLevel; // GREEN, YELLOW, ORANGE, RED

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }

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