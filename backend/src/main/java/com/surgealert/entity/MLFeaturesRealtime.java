package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ml_features_realtime")
public class MLFeaturesRealtime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "time", nullable = false)
    private LocalDateTime timestamp;

    @Column(name = "Month", nullable = true)
    private Integer month;

    @Column(name = "Hour", nullable = true)
    private Integer hour;

    @Column(name = "water_level", nullable = true)
    private Double waterLevel;

    @Column(name = "rise_rate", nullable = true)
    private Double riseRate;

    @Column(name = "sensor_rise_rate", nullable = true)
    private Double sensorRiseRate;

    @Column(name = "Tide_Height_m", nullable = true)
    private Double tideHeightM;

    @Column(name = "Tide_Trend", nullable = true)
    private Double tideTrend;

    @Column(name = "Rain_mm", nullable = true)
    private Double qcRainMm;

    @Column(name = "Rain_Lag1", nullable = true)
    private Double qcLag1Mm;

    @Column(name = "Rain_Lag2", nullable = true)
    private Double qcLag2Mm;

    @Column(name = "Rain_3hr_Sum", nullable = true)
    private Double qc3hrSum;

    @Column(name = "Rain_6hr_Sum", nullable = true)
    private Double qc6hrSum;

    @Column(name = "Marulas_Rain_mm", nullable = true)
    private Double marulasRainMm;

    @Column(name = "Mar_Rain_Lag1", nullable = true)
    private Double marLag1Mm;

    @Column(name = "Mar_Rain_Lag2", nullable = true)
    private Double marLag2Mm;

    @Column(name = "Mar_3hr_Sum", nullable = true)
    private Double mar3hrSum;

    @Column(name = "Mar_6hr_Sum", nullable = true)
    private Double mar6hrSum;

    @Column(name = "Mar_24hr_Sum", nullable = true)
    private Double mar24hrSum;

    @Column(name = "Pressure_hPa", nullable = true)
    private Double pressureHpa;

    @Column(name = "Press_Trend", nullable = true)
    private Double pressTrend;

    @Column(name = "Wind_Speed", nullable = true)
    private Double windSpeed;

    @Column(name = "Wind_Sin", nullable = true)
    private Double windSin;

    @Column(name = "Wind_Cos", nullable = true)
    private Double windCos;

    @Column(name = "Soil_Moisture", nullable = true)
    private Double soilMoisture;

    @Column(name = "predicted_alert_class", nullable = true)
    private Integer predictedAlertClass;

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
    public Integer getMonth() { return month; }
    public void setMonth(Integer month) { this.month = month; }
    public Integer getHour() { return hour; }
    public void setHour(Integer hour) { this.hour = hour; }
    public Double getWaterLevel() { return waterLevel; }
    public void setWaterLevel(Double waterLevel) { this.waterLevel = waterLevel; }
    public Double getRiseRate() { return riseRate; }
    public void setRiseRate(Double riseRate) { this.riseRate = riseRate; }
    public Double getSensorRiseRate() { return sensorRiseRate; }
    public void setSensorRiseRate(Double sensorRiseRate) { this.sensorRiseRate = sensorRiseRate; }
    public Double getTideHeightM() { return tideHeightM; }
    public void setTideHeightM(Double tideHeightM) { this.tideHeightM = tideHeightM; }
    public Double getTideTrend() { return tideTrend; }
    public void setTideTrend(Double tideTrend) { this.tideTrend = tideTrend; }
    public Double getQcRainMm() { return qcRainMm; }
    public void setQcRainMm(Double qcRainMm) { this.qcRainMm = qcRainMm; }
    public Double getQcLag1Mm() { return qcLag1Mm; }
    public void setQcLag1Mm(Double qcLag1Mm) { this.qcLag1Mm = qcLag1Mm; }
    public Double getQcLag2Mm() { return qcLag2Mm; }
    public void setQcLag2Mm(Double qcLag2Mm) { this.qcLag2Mm = qcLag2Mm; }
    public Double getQc3hrSum() { return qc3hrSum; }
    public void setQc3hrSum(Double qc3hrSum) { this.qc3hrSum = qc3hrSum; }
    public Double getQc6hrSum() { return qc6hrSum; }
    public void setQc6hrSum(Double qc6hrSum) { this.qc6hrSum = qc6hrSum; }
    public Double getMarulasRainMm() { return marulasRainMm; }
    public void setMarulasRainMm(Double marulasRainMm) { this.marulasRainMm = marulasRainMm; }
    public Double getMarLag1Mm() { return marLag1Mm; }
    public void setMarLag1Mm(Double marLag1Mm) { this.marLag1Mm = marLag1Mm; }
    public Double getMarLag2Mm() { return marLag2Mm; }
    public void setMarLag2Mm(Double marLag2Mm) { this.marLag2Mm = marLag2Mm; }
    public Double getMar3hrSum() { return mar3hrSum; }
    public void setMar3hrSum(Double mar3hrSum) { this.mar3hrSum = mar3hrSum; }
    public Double getMar6hrSum() { return mar6hrSum; }
    public void setMar6hrSum(Double mar6hrSum) { this.mar6hrSum = mar6hrSum; }
    public Double getMar24hrSum() { return mar24hrSum; }
    public void setMar24hrSum(Double mar24hrSum) { this.mar24hrSum = mar24hrSum; }
    public Double getPressureHpa() { return pressureHpa; }
    public void setPressureHpa(Double pressureHpa) { this.pressureHpa = pressureHpa; }
    public Double getPressTrend() { return pressTrend; }
    public void setPressTrend(Double pressTrend) { this.pressTrend = pressTrend; }
    public Double getWindSpeed() { return windSpeed; }
    public void setWindSpeed(Double windSpeed) { this.windSpeed = windSpeed; }
    public Double getWindSin() { return windSin; }
    public void setWindSin(Double windSin) { this.windSin = windSin; }
    public Double getWindCos() { return windCos; }
    public void setWindCos(Double windCos) { this.windCos = windCos; }
    public Double getSoilMoisture() { return soilMoisture; }
    public void setSoilMoisture(Double soilMoisture) { this.soilMoisture = soilMoisture; }
    public Integer getPredictedAlertClass() { return predictedAlertClass; }
    public void setPredictedAlertClass(Integer predictedAlertClass) { this.predictedAlertClass = predictedAlertClass; }
}
