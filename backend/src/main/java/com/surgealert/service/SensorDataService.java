package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.entity.MLFeaturesRealtime;
import com.surgealert.util.GridTimeUtils;
import com.surgealert.repository.SensorDataRepository;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Collections;
import java.util.stream.Collectors;

@Service
public class SensorDataService {
    private static final java.time.ZoneId MANILA_ZONE = java.time.ZoneId.of("Asia/Manila");
    private final SensorDataRepository sensorDataRepository;
    private final MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository;

    // Reads from application.properties → surgealert.sensor.depth-m →
    // SENSOR_DEPTH_M in .env
    @Value("${surgealert.sensor.depth-m:6.0}")
    private double sensorDepthM;

    @Value("${surgealert.thresholds.yellow:3.50}")
    private double yellowThreshold;

    @Value("${surgealert.thresholds.orange:4.50}")
    private double orangeThreshold;

    @Value("${surgealert.thresholds.red:5.50}")
    private double redThreshold;

    public SensorDataService(SensorDataRepository sensorDataRepository,
            MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository) {
        this.sensorDataRepository = sensorDataRepository;
        this.mlFeaturesRealtimeRepository = mlFeaturesRealtimeRepository;
    }

    /**
     * MQTT / edge telemetry ingest — sensor_data only (no tide, weather, or ml_features writes).
     * Images arrive via HTTPS {@code /edge/sync/snapshot}, not MQTT.
     */
    public SensorData saveSensorDataFromMqtt(SensorDataDTO dto) {
        if (dto != null) {
            dto.setSnapshotBase64(null);
        }
        return saveSensorData(dto);
    }

    /**
     * Persists one 5-minute grid telemetry row. Environmental tables are filled by {@link com.surgealert.service.DataCollectionScheduler} only.
     */
    public SensorData saveSensorData(SensorDataDTO dto) {
        if (dto == null) {
            return null;
        }
        if (dto.getWaterLevelM() != null && dto.getWaterLevelM() < 0.10) {
            System.out.println(" [DATA GUARD] Blocking ghost value: " + dto.getWaterLevelM() + "m");
            return null;
        }

        if (dto.getIsSimulated() != null && dto.getIsSimulated()) {
            System.out.println(" [DATA GUARD] Skipping simulated sensor data save.");
            return null;
        }

        if (dto.getWaterLevelM() == null) {
            System.err.println(" [DATA GUARD] Missing water_level in payload.");
            return null;
        }

        LocalDateTime gridTs = dto.getTimestamp() != null
                ? GridTimeUtils.alignToFiveMinuteGrid(dto.getTimestamp())
                : GridTimeUtils.alignToFiveMinuteGrid(LocalDateTime.now(MANILA_ZONE));

        Double riseMph = dto.getRiseRate() != null ? dto.getRiseRate() : 0.0;

        SensorData sensorData = sensorDataRepository.findFirstByTimestampOrderByIdDesc(gridTs)
                .orElseGet(SensorData::new);
        sensorData.setTimestamp(gridTs);
        sensorData.setWaterLevelM(dto.getWaterLevelM());
        sensorData.setSensorFlowRate(dto.getSensorFlowRate() != null ? dto.getSensorFlowRate() : 0.0);
        sensorData.setImageFlowRate(dto.getImageFlowRate() != null ? dto.getImageFlowRate() : 0.0);
        if (dto.getFusedFlowRate() != null) {
            sensorData.setFusedFlowRate(dto.getFusedFlowRate());
        }
        sensorData.setRiseRate(riseMph);

        String alertLevel = dto.getCurrentAlertLevel();
        if (alertLevel == null || alertLevel.isEmpty()) {
            alertLevel = calculateFallbackAlertLevel(dto.getWaterLevelM());
        }
        sensorData.setCurrentAlertLevel(alertLevel.toUpperCase());

        if (dto.getPredictedLevel() != null) {
            sensorData.setPredictedLevel(dto.getPredictedLevel());
        } else {
            sensorData.setPredictedLevel(dto.getWaterLevelM());
        }

        String predictedAlert = dto.getPredictedAlertLevel();
        if (predictedAlert != null && !predictedAlert.isEmpty()) {
            sensorData.setPredictedAlertLevel(predictedAlert);
        } else {
            sensorData.setPredictedAlertLevel(calculateFallbackAlertLevel(sensorData.getPredictedLevel()));
        }

        return sensorDataRepository.save(sensorData);
    }

    public SensorDataDTO getLatestSensorData() {
        return sensorDataRepository.findFirstByOrderByTimestampDesc()
                .map(this::convertEntityToLatestDto)
                .orElse(null);
    }

    private SensorDataDTO convertEntityToLatestDto(SensorData row) {
        SensorDataDTO dto = new SensorDataDTO();
        dto.setId(row.getId());
        dto.setTimestamp(row.getTimestamp());
        dto.setWaterLevelM(row.getWaterLevelM());
        dto.setSensorFlowRate(row.getSensorFlowRate());
        dto.setImageFlowRate(row.getImageFlowRate());
        dto.setFusedFlowRate(row.getFusedFlowRate());
        dto.setRiseRate(row.getRiseRate());
        dto.setCurrentAlertLevel(row.getCurrentAlertLevel());
        dto.setPredictedLevel(row.getPredictedLevel());
        dto.setPredictedAlertLevel(row.getPredictedAlertLevel());
        if (row.getImageBytes() != null && row.getImageBytes().length > 0) {
            dto.setSnapshotBase64(java.util.Base64.getEncoder().encodeToString(row.getImageBytes()));
        }
        return dto;
    }

    private SensorDataDTO convertLatestProjectionToDTO(SensorDataRepository.LatestSensorProjection row) {
        SensorDataDTO dto = new SensorDataDTO();
        dto.setId(row.getId());
        dto.setTimestamp(row.getTimestamp());
        dto.setWaterLevelM(row.getWaterLevelM());
        dto.setSensorFlowRate(row.getSensorFlowRate());
        dto.setImageFlowRate(row.getImageFlowRate());
        dto.setRiseRate(row.getRiseRate());
        dto.setCurrentAlertLevel(row.getCurrentAlertLevel());
        dto.setPredictedLevel(row.getPredictedLevel());
        dto.setPredictedAlertLevel(row.getPredictedAlertLevel());
        return dto;
    }

    public List<SensorDataDTO> getRecentSensorData(int hours) {
        // Charts must reflect rows in sensor_data up to wall-clock "now".
        // Camera delay applies only to getLatestSensorData() (align live image with telemetry).
        LocalDateTime liveNow = LocalDateTime.now(MANILA_ZONE);
        LocalDateTime since = liveNow.minusHours(hours);

        List<SensorData> coreData = sensorDataRepository.findByTimestampBetween(since, liveNow);
        coreData.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));

        // Optimization: Fetch all potentially relevant ML features in one go (with 1h buffer)
        List<MLFeaturesRealtime> mlList = mlFeaturesRealtimeRepository
                .findByTimestampBetween(since.minusHours(1), liveNow.plusMinutes(1));
        final List<MLFeaturesRealtime> mlCandidates = mlList;

        return coreData.stream().map(sd -> {
            SensorDataDTO dto = new SensorDataDTO();
            dto.setId(sd.getId());
            dto.setTimestamp(sd.getTimestamp());
            dto.setWaterLevelM(sd.getWaterLevelM());
            dto.setSensorFlowRate(sd.getSensorFlowRate());
            dto.setImageFlowRate(sd.getImageFlowRate());
            dto.setFusedFlowRate(sd.getFusedFlowRate());
            dto.setRiseRate(sd.getRiseRate());
            dto.setCurrentAlertLevel(sd.getCurrentAlertLevel());
            dto.setPredictedLevel(sd.getPredictedLevel());
            dto.setPredictedAlertLevel(sd.getPredictedAlertLevel());

            // charts only need numeric series from sensor_data — omit image_bytes.

            // Memory-efficient Nearest Neighbor join
            LocalDateTime ts = sd.getTimestamp();
            mlCandidates.stream()
                .filter(m -> {
                    long diff = Math.abs(java.time.Duration.between(m.getTimestamp(), ts).getSeconds());
                    return diff < 3900; // 65 minutes
                })
                .min((m1, m2) -> {
                    long diff1 = Math.abs(java.time.Duration.between(m1.getTimestamp(), ts).getSeconds());
                    long diff2 = Math.abs(java.time.Duration.between(m2.getTimestamp(), ts).getSeconds());
                    return Long.compare(diff1, diff2);
                })
                .ifPresent(m -> mapEnvironmentalFields(dto, m));

            return dto;
        }).collect(Collectors.toList());
    }

    private SensorDataDTO convertToDTO(SensorData sensorData) {
        SensorDataDTO dto = new SensorDataDTO();
        dto.setId(sensorData.getId());
        dto.setTimestamp(sensorData.getTimestamp());
        dto.setWaterLevelM(sensorData.getWaterLevelM());
        dto.setSensorFlowRate(sensorData.getSensorFlowRate());
        dto.setImageFlowRate(sensorData.getImageFlowRate());
        dto.setRiseRate(sensorData.getRiseRate());
        dto.setCurrentAlertLevel(sensorData.getCurrentAlertLevel());
        dto.setPredictedLevel(sensorData.getPredictedLevel());
        dto.setPredictedAlertLevel(sensorData.getPredictedAlertLevel());

        if (sensorData.getImageBytes() != null) {
            dto.setSnapshotBase64(java.util.Base64.getEncoder().encodeToString(sensorData.getImageBytes()));
        }

        // --- ENVIROMENTAL JOIN (Nearest Neighbor) ---
        // Look for the closest ML features record within a 65-minute window of the sensor record.
        LocalDateTime ts = sensorData.getTimestamp();
        mlFeaturesRealtimeRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(ts.plusSeconds(30))
            .ifPresent(m -> {
                long diffSeconds = Math.abs(java.time.Duration.between(m.getTimestamp(), ts).getSeconds());
                if (diffSeconds < 3900) { // Approx 1 hour + margin
                    mapEnvironmentalFields(dto, m);
                }
            });

        return dto;
    }

    private void mapEnvironmentalFields(SensorDataDTO dto, MLFeaturesRealtime m) {
        dto.setTideHeightM(m.getTideHeightM());
        dto.setTideTrend(m.getTideTrend());
        dto.setRainMm(m.getQcRainMm());
        dto.setMarulasRainMm(m.getMarulasRainMm());
        dto.setMar24hrSum(m.getMar24hrSum());
        dto.setPressureHpa(m.getPressureHpa());
        dto.setWindSpeedKph(m.getWindSpeed());
        dto.setSoilMoisturePct(m.getSoilMoisture());
        dto.setPredictedAlertClass(m.getPredictedAlertClass());
        dto.setQcLag1(m.getQcLag1Mm());
        dto.setQcLag2(m.getQcLag2Mm());
        dto.setMarLag1(m.getMarLag1Mm());
        dto.setMarLag2(m.getMarLag2Mm());
        dto.setMar3hrSum(m.getMar3hrSum());
        dto.setPressTrend(m.getPressTrend());
        dto.setQc3hrSum(m.getQc3hrSum());
        dto.setQc6hrSum(m.getQc6hrSum());
        dto.setWindSin(m.getWindSin());
        dto.setWindCos(m.getWindCos());
    }

    // Fallback alert classifier — used only when the Edge system is offline.
    // Thresholds are derived from application.properties or .env
    private String calculateFallbackAlertLevel(Double waterLevel) {
        if (waterLevel == null)
            return "GREEN";
        if (waterLevel >= redThreshold)
            return "RED";
        if (waterLevel >= orangeThreshold)
            return "ORANGE";
        if (waterLevel >= yellowThreshold)
            return "YELLOW";
        return "GREEN";
    }

    private String loadSimulatedImage(String alertLevel) {
        String filename = "normal.jpg";
        if (alertLevel != null) {
            String level = alertLevel.toUpperCase();
            if (level.equals("RED") || level.equals("CRITICAL")) {
                filename = "flood.jpg";
            } else if (level.equals("YELLOW") || level.equals("ORANGE")) {
                filename = "rising.jpg";
            }
        }
        
        try {
            java.nio.file.Path path = java.nio.file.Paths.get("data", "simulation_images", filename);
            if (!java.nio.file.Files.exists(path)) {
                // Fallback to normal.jpg
                path = java.nio.file.Paths.get("data", "simulation_images", "normal.jpg");
            }
            if (java.nio.file.Files.exists(path)) {
                byte[] bytes = java.nio.file.Files.readAllBytes(path);
                return java.util.Base64.getEncoder().encodeToString(bytes);
            }
        } catch (Exception e) {
            System.err.println(" [Simulation] Failed to load simulation image: " + e.getMessage());
        }
        return null;
    }

    /**
     * Attach image_bytes to the sensor_data row nearest the given grid timestamp (edge HTTPS upload).
     */
    @Transactional
    public boolean attachSnapshotByTimestamp(String timestampIso, String snapshotBase64) {
        try {
            LocalDateTime gridTs = GridTimeUtils.parseAndAlignGridTimestamp(timestampIso);
            Optional<SensorData> opt = sensorDataRepository.findFirstByTimestampOrderByIdDesc(gridTs);
            if (opt.isEmpty()) {
                opt = sensorDataRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(gridTs);
            }
            if (opt.isEmpty()) {
                LocalDateTime from = gridTs.minusMinutes(10);
                var recent = sensorDataRepository.findByTimestampBetween(from, gridTs.plusMinutes(1));
                if (!recent.isEmpty()) {
                    opt = Optional.of(recent.get(recent.size() - 1));
                }
            }
            if (opt.isEmpty()) {
                sensorDataRepository.findFirstByOrderByTimestampDesc().ifPresent(latest ->
                        System.err.println(" [Storage] No sensor_data row for grid time " + gridTs
                                + "; latest row is " + latest.getTimestamp()));
                if (sensorDataRepository.count() == 0) {
                    System.err.println(" [Storage] sensor_data table is empty — MQTT/telemetry ingest may have failed.");
                }
                return false;
            }
            byte[] imageBytes = java.util.Base64.getDecoder().decode(snapshotBase64);
            SensorData sd = opt.get();
            sd.setImageBytes(imageBytes);
            sensorDataRepository.save(sd);
            return true;
        } catch (Exception e) {
            System.err.println(" [Storage] Snapshot attach failed: " + e.getMessage());
            return false;
        }
    }
}