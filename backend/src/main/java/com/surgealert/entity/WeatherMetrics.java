package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "weather_metrics")
public class WeatherMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "time", nullable = false)
    private LocalDateTime timestamp;

    @Column(name = "qc_rain_mm", nullable = true)
    private Double qcRainMm;

    @Column(name = "marulas_rain_mm", nullable = true)
    private Double marulasRainMm;

    @Column(name = "mar_24hr_sum", nullable = true)
    private Double mar24hrSum;

    @Column(name = "pressure_hpa", nullable = true)
    private Double pressureHpa;

    @Column(name = "wind_speed", nullable = true)
    private Double windSpeed;

    @Column(name = "wind_direction_deg", nullable = true)
    private Double windDirectionDeg;

    @Column(name = "soil_moisture", nullable = true)
    private Double soilMoisture;

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

    public Double getQcRainMm() { return qcRainMm; }
    public void setQcRainMm(Double qcRainMm) { this.qcRainMm = qcRainMm; }

    public Double getMarulasRainMm() { return marulasRainMm; }
    public void setMarulasRainMm(Double marulasRainMm) { this.marulasRainMm = marulasRainMm; }

    public Double getMar24hrSum() { return mar24hrSum; }
    public void setMar24hrSum(Double mar24hrSum) { this.mar24hrSum = mar24hrSum; }

    public Double getPressureHpa() { return pressureHpa; }
    public void setPressureHpa(Double pressureHpa) { this.pressureHpa = pressureHpa; }

    public Double getWindSpeed() { return windSpeed; }
    public void setWindSpeed(Double windSpeed) { this.windSpeed = windSpeed; }

    public Double getWindDirectionDeg() { return windDirectionDeg; }
    public void setWindDirectionDeg(Double windDirectionDeg) { this.windDirectionDeg = windDirectionDeg; }

    public Double getSoilMoisture() { return soilMoisture; }
    public void setSoilMoisture(Double soilMoisture) { this.soilMoisture = soilMoisture; }
}
