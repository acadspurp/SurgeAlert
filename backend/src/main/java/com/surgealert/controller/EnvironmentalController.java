package com.surgealert.controller;

import com.surgealert.repository.MLFeaturesRealtimeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Provides the latest environmental context directly from
 * the ml_features_realtime table for simulation mode.
 */
@RestController
@RequestMapping("/api/admin/environmental")
@CrossOrigin(origins = "*")
public class EnvironmentalController {

    private final MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository;

    public EnvironmentalController(MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository) {
        this.mlFeaturesRealtimeRepository = mlFeaturesRealtimeRepository;
    }

    /**
     * GET /api/admin/environmental/latest
     * Returns the most recent row from ml_features_realtime (simulated data).
     */
    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> getLatestEnvironmental() {
        Map<String, Object> result = new LinkedHashMap<>();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        mlFeaturesRealtimeRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now).ifPresent(m -> {
            result.put("tideHeightM", m.getTideHeightM());
            result.put("tideTrend",   m.getTideTrend());
            result.put("tideTimestamp", m.getTimestamp() != null ? m.getTimestamp().toString() : null);

            result.put("qcRainMm",       m.getQcRainMm());
            result.put("marulasRainMm",  m.getMarulasRainMm());
            result.put("mar24hrSum",     m.getMar24hrSum());
            result.put("pressureHpa",    m.getPressureHpa());
            result.put("windSpeed",      m.getWindSpeed());
            result.put("soilMoisture",   m.getSoilMoisture());
            result.put("weatherTimestamp", m.getTimestamp() != null ? m.getTimestamp().toString() : null);
        });

        if (result.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(result);
    }
}
