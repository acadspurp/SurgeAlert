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

    @Value("${surgealert.thresholds.yellow:3.50}")
    private double yellowThreshold;

    @Value("${surgealert.thresholds.orange:4.50}")
    private double orangeThreshold;

    @Value("${surgealert.thresholds.red:5.50}")
    private double redThreshold;

    @GetMapping("/thresholds")
    public ResponseEntity<Map<String, Object>> getThresholds() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sensorDepthM", sensorDepthM);

        Map<String, Double> thresholds = new LinkedHashMap<>();
        thresholds.put("yellow", yellowThreshold);
        thresholds.put("orange", orangeThreshold);
        thresholds.put("red", redThreshold);
        response.put("thresholds", thresholds);

        return ResponseEntity.ok(response);
    }

    //private double round2(double value) {
     //   return Math.round(value * 100.0) / 100.0;
   // }
}
