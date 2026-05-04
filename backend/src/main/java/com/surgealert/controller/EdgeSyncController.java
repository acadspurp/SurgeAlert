package com.surgealert.controller;

import com.surgealert.dto.AlertTemplateDTO;
import com.surgealert.repository.AlertTemplateRepository;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import com.surgealert.service.ResidentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Special controller for the Edge System (Raspberry Pi) to sync data.
 * This allows the Pi to function even when the internet is unstable.
 */
@RestController
@RequestMapping("/api/edge/sync")
@CrossOrigin(origins = "*")
public class EdgeSyncController {

    private final ResidentService residentService;
    private final AlertTemplateRepository templateRepository;
    private final MLFeaturesRealtimeRepository mlRepository;

    @Autowired
    public EdgeSyncController(ResidentService residentService, 
                              AlertTemplateRepository templateRepository,
                              MLFeaturesRealtimeRepository mlRepository) {
        this.residentService = residentService;
        this.templateRepository = templateRepository;
        this.mlRepository = mlRepository;
    }

    /**
     * Returns everything the Pi needs to know to send SMS alerts offline.
     */
    @GetMapping("/all")
    public ResponseEntity<Map<String, Object>> syncAll(@RequestHeader(value = "X-Edge-Key", required = false) String edgeKey) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("residents", residentService.getAllActivePhoneNumbers());
        List<AlertTemplateDTO> templates = templateRepository.findAll().stream()
                .map(t -> new AlertTemplateDTO(t.getId(), t.getAlertType(), t.getTemplate()))
                .collect(Collectors.toList());
        data.put("templates", templates);
        data.put("otps", getActiveOtps());
        return ResponseEntity.ok(data);
    }

    /**
     * Fetches the latest environmental data (Weather, Tides, Lags) calculated by the backend.
     * The Pi uses this every 30 mins to run its ML Classifier.
     */
    @GetMapping("/environmental")
    public ResponseEntity<Map<String, Object>> syncEnvironmental() {
        Map<String, Object> data = new LinkedHashMap<>();
        mlRepository.findFirstByOrderByTimestampDesc().ifPresent(ml -> {
            data.put("month", ml.getMonth());
            data.put("hour", ml.getHour());
            data.put("tide_height", ml.getTideHeightM());
            data.put("tide_trend", ml.getTideTrend());
            data.put("pressure", ml.getPressureHpa());
            data.put("press_trend", ml.getPressTrend());
            data.put("wind_speed", ml.getWindSpeed());
            data.put("wind_sin", ml.getWindSin());
            data.put("wind_cos", ml.getWindCos());
            data.put("soil_moisture", ml.getSoilMoisture());
            data.put("qc_rain", ml.getQcRainMm());
            data.put("qc_lag1", ml.getQcLag1Mm());
            data.put("qc_lag2", ml.getQcLag2Mm());
            data.put("qc_3h", ml.getQc3hrSum());
            data.put("qc_6h", ml.getQc6hrSum());
            data.put("mar_rain", ml.getMarulasRainMm());
            data.put("mar_lag1", ml.getMarLag1Mm());
            data.put("mar_lag2", ml.getMarLag2Mm());
            data.put("mar_3h", ml.getMar3hrSum());
            data.put("mar_6h", ml.getMar6hrSum());
            data.put("mar_24h", ml.getMar24hrSum());
        });
        return ResponseEntity.ok(data);
    }

    private Map<String, String> getActiveOtps() {
        return residentService.getActiveOtps();
    }
}
