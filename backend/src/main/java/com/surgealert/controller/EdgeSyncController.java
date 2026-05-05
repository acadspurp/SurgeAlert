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

    @Autowired
    private com.surgealert.repository.SensorDataRepository sensorDataRepository;

    /**
     * Fetches the latest simulated environmental data and water level.
     * The Pi uses this every 10 mins to display the simulation status.
     */
    @GetMapping("/environmental")
    public ResponseEntity<Map<String, Object>> syncEnvironmental() {
        Map<String, Object> data = new LinkedHashMap<>();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        sensorDataRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now).ifPresent(sd -> {
            data.put("water_level", sd.getWaterLevelM());
            data.put("alert_level", sd.getCurrentAlertLevel());
            data.put("flow_rate", sd.getSensorFlowRateMps());
            data.put("rise_rate", sd.getImageRiseRateMps());
            data.put("timestamp", sd.getTimestamp().toString());
        });

        mlRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now).ifPresent(ml -> {
            data.put("tide_height", ml.getTideHeightM());
            data.put("tide_trend", ml.getTideTrend());
            data.put("pressure", ml.getPressureHpa());
            data.put("wind_speed", ml.getWindSpeed());
            data.put("qc_rain", ml.getQcRainMm());
            data.put("mar_rain", ml.getMarulasRainMm());
            data.put("soil_moisture", ml.getSoilMoisture());
        });
        return ResponseEntity.ok(data);
    }

    private Map<String, String> getActiveOtps() {
        return residentService.getActiveOtps();
    }
}
