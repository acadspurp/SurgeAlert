package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tide_metrics")
public class TideMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;

    /**
     * Legacy column kept in some deployed databases.
     * We populate both `timestamp` and `time` to stay schema-compatible.
     */
    @Column(name = "time", nullable = false)
    private LocalDateTime legacyTime;

    @Column(name = "tide_height_m", nullable = false)
    private Double tideHeightM;

    @Column(name = "tide_trend")
    private Double tideTrend;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (timestamp == null && legacyTime == null) {
            timestamp = now;
            legacyTime = now;
            return;
        }
        if (timestamp == null) {
            timestamp = legacyTime;
        }
        if (legacyTime == null) {
            legacyTime = timestamp;
        }
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) {
        LocalDateTime value = (timestamp != null) ? timestamp : LocalDateTime.now();
        this.timestamp = value;
        this.legacyTime = value;
    }

    public LocalDateTime getLegacyTime() { return legacyTime; }
    public void setLegacyTime(LocalDateTime legacyTime) {
        LocalDateTime value = (legacyTime != null) ? legacyTime : LocalDateTime.now();
        this.legacyTime = value;
        if (this.timestamp == null) {
            this.timestamp = value;
        }
    }

    public Double getTideHeightM() { return tideHeightM; }
    public void setTideHeightM(Double tideHeightM) { this.tideHeightM = tideHeightM; }

    public Double getTideTrend() { return tideTrend; }
    public void setTideTrend(Double tideTrend) { this.tideTrend = tideTrend; }
}
