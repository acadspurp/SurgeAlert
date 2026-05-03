package com.surgealert.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tide_metrics")
public class TideMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(name = "tide_height_m", nullable = false)
    private Double tideHeightM;

    @Column(name = "tide_trend")
    private Double tideTrend;

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

    public Double getTideHeightM() { return tideHeightM; }
    public void setTideHeightM(Double tideHeightM) { this.tideHeightM = tideHeightM; }

    public Double getTideTrend() { return tideTrend; }
    public void setTideTrend(Double tideTrend) { this.tideTrend = tideTrend; }
}
