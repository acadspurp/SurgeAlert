package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sensor_data")
public class SensorData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "time", nullable = false)
    private LocalDateTime timestamp;

    @Column(name = "water_level", nullable = false)
    private Double waterLevelM;

    @Column(name = "sensor_flow_rate", nullable = false)
    private Double sensorFlowRate;

    @Column(name = "image_flow_rate", nullable = false)
    private Double imageFlowRate;

    /** Radar + CV fused flow (m/s). */
    @Column(name = "fused_flow_rate")
    private Double fusedFlowRate;

    /** Ultrasonic rise rate in meters per hour (m/h). */
    @Column(name = "rise_rate", nullable = false)
    private Double riseRate;

    @Column(nullable = false)
    private String currentAlertLevel;

    @Column(nullable = true)
    private Double predictedLevel;

    @Column(nullable = true)
    private String predictedAlertLevel;

    @Lob
    @Column(name = "image_bytes", columnDefinition = "bytea")
    private byte[] imageBytes;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Double getWaterLevelM() { return waterLevelM; }
    public void setWaterLevelM(Double waterLevelM) { this.waterLevelM = waterLevelM; }

    public Double getSensorFlowRate() { return sensorFlowRate; }
    public void setSensorFlowRate(Double sensorFlowRate) { this.sensorFlowRate = sensorFlowRate; }

    public Double getImageFlowRate() { return imageFlowRate; }
    public void setImageFlowRate(Double imageFlowRate) { this.imageFlowRate = imageFlowRate; }

    public Double getFusedFlowRate() { return fusedFlowRate; }
    public void setFusedFlowRate(Double fusedFlowRate) { this.fusedFlowRate = fusedFlowRate; }

    public Double getRiseRate() { return riseRate; }
    public void setRiseRate(Double riseRate) { this.riseRate = riseRate; }

    public String getCurrentAlertLevel() { return currentAlertLevel; }
    public void setCurrentAlertLevel(String currentAlertLevel) { this.currentAlertLevel = currentAlertLevel; }

    public Double getPredictedLevel() { return predictedLevel; }
    public void setPredictedLevel(Double predictedLevel) { this.predictedLevel = predictedLevel; }

    public String getPredictedAlertLevel() { return predictedAlertLevel; }
    public void setPredictedAlertLevel(String predictedAlertLevel) { this.predictedAlertLevel = predictedAlertLevel; }

    public byte[] getImageBytes() { return imageBytes; }
    public void setImageBytes(byte[] imageBytes) { this.imageBytes = imageBytes; }
}
