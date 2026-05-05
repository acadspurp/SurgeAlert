package com.surgealert.controller;

import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Provides the latest environmental context (tide + weather) directly from
 * the tide_metrics and weather_metrics tables.
 *
 * This endpoint is independent of sensor_data, so it works even when the
 * Raspberry Pi is offline but the tables have been populated by the Scheduler
 * or a previous Pi session.
 */
@RestController
@RequestMapping("/api/admin/environmental")
@CrossOrigin(origins = "*")
public class EnvironmentalController {

    private final TideMetricsRepository tideMetricsRepository;
    private final WeatherMetricsRepository weatherMetricsRepository;

    public EnvironmentalController(TideMetricsRepository tideMetricsRepository,
                                   WeatherMetricsRepository weatherMetricsRepository) {
        this.tideMetricsRepository = tideMetricsRepository;
        this.weatherMetricsRepository = weatherMetricsRepository;
    }

    /**
     * GET /api/admin/environmental/latest
     * Returns the most recent row from tide_metrics joined with weather_metrics.
     */
    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> getLatestEnvironmental() {
        Map<String, Object> result = new LinkedHashMap<>();

        tideMetricsRepository.findFirstByOrderByTimestampDesc().ifPresent(t -> {
            result.put("tideHeightM", t.getTideHeightM());
            result.put("tideTrend",   t.getTideTrend());
            result.put("tideTimestamp", t.getTimestamp() != null ? t.getTimestamp().toString() : null);
        });

        weatherMetricsRepository.findFirstByOrderByTimestampDesc().ifPresent(w -> {
            result.put("qcRainMm",       w.getQcRainMm());
            result.put("marulasRainMm",  w.getMarulasRainMm());
            result.put("mar24hrSum",     w.getMar24hrSum());
            result.put("pressureHpa",    w.getPressureHpa());
            result.put("windSpeed",      w.getWindSpeed());
            result.put("soilMoisture",   w.getSoilMoisture());
            result.put("weatherTimestamp", w.getTimestamp() != null ? w.getTimestamp().toString() : null);
        });

        if (result.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(result);
    }
}
