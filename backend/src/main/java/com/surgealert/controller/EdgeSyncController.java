package com.surgealert.controller;

import com.surgealert.dto.AlertTemplateDTO;
import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.repository.AlertTemplateRepository;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import com.surgealert.service.ResidentService;
import com.surgealert.service.OverrideSmsBroadcastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;

//import java.lang.reflect.Field;
//import java.util.HashMap;
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
    private final com.surgealert.service.SensorDataService sensorDataService;
    private final com.surgealert.service.MlModelRegistryService mlModelRegistry;
    private final com.surgealert.service.MlTrainingService mlTrainingService;
    private final OverrideSmsBroadcastService overrideSmsBroadcastService;

    @Autowired
    public EdgeSyncController(ResidentService residentService,
                              AlertTemplateRepository templateRepository,
                              MLFeaturesRealtimeRepository mlRepository,
                              com.surgealert.service.SensorDataService sensorDataService,
                              com.surgealert.service.MlModelRegistryService mlModelRegistry,
                              com.surgealert.service.MlTrainingService mlTrainingService,
                              OverrideSmsBroadcastService overrideSmsBroadcastService) {
        this.residentService = residentService;
        this.templateRepository = templateRepository;
        this.mlRepository = mlRepository;
        this.sensorDataService = sensorDataService;
        this.mlModelRegistry = mlModelRegistry;
        this.mlTrainingService = mlTrainingService;
        this.overrideSmsBroadcastService = overrideSmsBroadcastService;
    }

    /**
     * Returns everything the Pi needs to know to send SMS alerts offline.
     */
    @GetMapping("/all")
    public ResponseEntity<Map<String, Object>> syncAll() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("residents", residentService.getActiveResidentsForEdgeSync());
        List<AlertTemplateDTO> templates = templateRepository.findAll().stream()
                .map(t -> new AlertTemplateDTO(t.getId(), t.getAlertType(), t.getTemplate()))
                .collect(Collectors.toList());
        data.put("templates", templates);
        data.put("otps", getActiveOtps());
        overrideSmsBroadcastService.peekPending().ifPresent(b -> {
            Map<String, String> override = new LinkedHashMap<>();
            override.put("id", b.id());
            override.put("level", b.level());
            override.put("message", b.message());
            data.put("overrideSmsBroadcast", override);
        });
        return ResponseEntity.ok(data);
    }

    /** Pi confirms manual-override GSM broadcast was delivered locally. */
    @PostMapping("/override-sms/ack")
    public ResponseEntity<Map<String, String>> ackOverrideSms(@RequestBody Map<String, String> body) {
        if (body != null && body.get("id") != null) {
            overrideSmsBroadcastService.clearPending(body.get("id"));
        }
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("status", "ok");
        return ResponseEntity.ok(resp);
    }

    @Autowired
    private com.surgealert.repository.SensorDataRepository sensorDataRepository;

    /**
     * Edge HTTPS ingest for one telemetry row (same payload as MQTT). Ensures sensor_data exists
     * before {@link #uploadSnapshot(Map)} when broker delivery is slow.
     */
    @PostMapping("/telemetry")
    public ResponseEntity<Map<String, Object>> ingestTelemetry(@RequestBody SensorDataDTO dto) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            if (dto == null) {
                resp.put("error", "Request body is empty.");
                return ResponseEntity.badRequest().body(resp);
            }
            SensorData saved = sensorDataService.saveSensorDataFromMqtt(dto);
            if (saved == null) {
                resp.put("status", "skipped");
                resp.put("error", "Row not saved (missing water_level, ghost level, simulated flag, or invalid payload).");
                return ResponseEntity.badRequest().body(resp);
            }
            resp.put("status", "ok");
            resp.put("id", saved.getId());
            resp.put("timestamp", saved.getTimestamp().toString());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            System.err.println(" [Edge] Telemetry ingest failed: " + e.getMessage());
            e.printStackTrace();
            resp.put("error", e.getMessage() != null ? e.getMessage() : "Internal error");
            return ResponseEntity.internalServerError().body(resp);
        }
    }

    /**
     * Edge uploads camera snapshot (base64) over HTTPS; MQTT carries telemetry only.
     */
    @PostMapping("/snapshot")
    public ResponseEntity<Map<String, String>> uploadSnapshot(@RequestBody Map<String, String> body) {
        String timestamp = body.get("timestamp");
        String snapshotBase64 = body.get("snapshotBase64");
        if (timestamp == null || snapshotBase64 == null || snapshotBase64.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        boolean attached = sensorDataService.attachSnapshotByTimestamp(timestamp, snapshotBase64);
        if (!attached) {
            System.err.println(" [Edge] Snapshot not attached for timestamp=" + timestamp);
            return ResponseEntity.notFound().build();
        }
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("status", "ok");
        return ResponseEntity.ok(resp);
    }

    /** Pi downloads latest trained XGBoost artifact (auto-improve pipeline). */
    @GetMapping("/model")
    public ResponseEntity<Resource> downloadModel() {
        if (!mlModelRegistry.modelArtifactExists()) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = new FileSystemResource(mlModelRegistry.getModelFilePath().toFile());
        return ResponseEntity.ok()
                .header("X-Model-Version", mlModelRegistry.getCurrentVersion())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=flood_prediction_model.joblib")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @PostMapping("/retrain")
    public ResponseEntity<Map<String, Object>> triggerRetrain() {
        boolean ok = mlTrainingService.runScheduledRetrain();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", ok);
        body.put("version", mlModelRegistry.getCurrentVersion());
        return ok ? ResponseEntity.ok(body) : ResponseEntity.internalServerError().body(body);
    }

    /**
     * Latest ml_features_realtime row for edge ML inference (rainfall, tide, pressure, etc.).
     */
    @GetMapping("/ml-features")
    public ResponseEntity<Map<String, Object>> syncMlFeatures() {
        Map<String, Object> data = new LinkedHashMap<>();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        mlRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now).ifPresent(ml -> {
            data.put("timestamp", ml.getTimestamp() != null ? ml.getTimestamp().toString() : null);
            data.put("water_level", ml.getWaterLevel());
            data.put("rise_rate", ml.getRiseRate());
            data.put("Tide_Height_m", ml.getTideHeightM());
            data.put("Tide_Trend", ml.getTideTrend());
            data.put("QC_Rain_mm", ml.getQcRainMm());
            data.put("QC_Lag1", ml.getQcLag1Mm());
            data.put("QC_Lag2", ml.getQcLag2Mm());
            data.put("QC_3hr_Sum", ml.getQc3hrSum());
            data.put("QC_6hr_Sum", ml.getQc6hrSum());
            data.put("Marulas_Rain_mm", ml.getMarulasRainMm());
            data.put("Mar_Lag1", ml.getMarLag1Mm());
            data.put("Mar_Lag2", ml.getMarLag2Mm());
            data.put("Mar_3hr_Sum", ml.getMar3hrSum());
            data.put("Mar_6hr_Sum", ml.getMar6hrSum());
            data.put("Mar_24hr_Sum", ml.getMar24hrSum());
            data.put("Pressure_hPa", ml.getPressureHpa());
            data.put("Press_Trend", ml.getPressTrend());
            data.put("Wind_Speed", ml.getWindSpeed());
            data.put("Wind_Sin", ml.getWindSin());
            data.put("Wind_Cos", ml.getWindCos());
            data.put("Soil_Moisture", ml.getSoilMoisture());
            data.put("predicted_alert_class", ml.getPredictedAlertClass());
        });
        return ResponseEntity.ok(data);
    }

    /**
     * Fetches the latest environmental data (legacy display endpoint).
     */
    @GetMapping("/environmental")
    public ResponseEntity<Map<String, Object>> syncEnvironmental() {
        Map<String, Object> data = new LinkedHashMap<>();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        sensorDataRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now).ifPresent(sd -> {
            data.put("water_level", sd.getWaterLevelM());
            data.put("alert_level", sd.getCurrentAlertLevel());
            data.put("flow_rate", sd.getSensorFlowRate());
            data.put("rise_rate", sd.getRiseRate());
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
