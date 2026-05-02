package com.surgealert.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Exposes the system's sensor depth and derived alert thresholds to any client.
 *
 * The ONLY value that drives everything here is:
 *   SENSOR_DEPTH_M  in the root .env file  (e.g. SENSOR_DEPTH_M=6.1)
 *
 * The frontend fetches GET /api/public/config/thresholds on page load and uses
 * the response for the gauge, legend table, and alert classification.
 * No threshold numbers are hardcoded anywhere in the frontend.
 */
@RestController
@RequestMapping("/api/public/config")
@CrossOrigin(origins = "*")
public class ConfigController {

    // Reads from application.properties → surgealert.sensor.depth-m → SENSOR_DEPTH_M env var
    @Value("${surgealert.sensor.depth-m:6.1}")
    private double sensorDepthM;

    // Threshold ratios — same percentages used by EdgeSystem/config/settings.py
    private static final double YELLOW_RATIO = 0.57;
    private static final double ORANGE_RATIO = 0.74;
    private static final double RED_RATIO    = 0.90;

    /**
     * Returns sensor depth and all alert thresholds, computed from the single env var.
     *
     * Response shape:
     * {
     *   "sensorDepthM": 6.1,
     *   "thresholds": {
     *     "yellow": 3.48,
     *     "orange": 4.51,
     *     "red":    5.49
     *   }
     * }
     */
    @GetMapping("/thresholds")
    public ResponseEntity<Map<String, Object>> getThresholds() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sensorDepthM", sensorDepthM);

        Map<String, Double> thresholds = new LinkedHashMap<>();
        thresholds.put("yellow", round2(sensorDepthM * YELLOW_RATIO));
        thresholds.put("orange", round2(sensorDepthM * ORANGE_RATIO));
        thresholds.put("red",    round2(sensorDepthM * RED_RATIO));
        response.put("thresholds", thresholds);

        return ResponseEntity.ok(response);
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
