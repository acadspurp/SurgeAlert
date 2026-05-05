package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import com.surgealert.entity.SensorData;
import com.surgealert.entity.TideMetrics;
import com.surgealert.entity.WeatherMetrics;
import com.surgealert.entity.MLFeaturesRealtime;
import com.surgealert.repository.SensorDataRepository;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Collections;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private final SensorDataRepository sensorDataRepository;
    private final TideMetricsRepository tideMetricsRepository;
    private final WeatherMetricsRepository weatherMetricsRepository;
    private final MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository;

    // Reads from application.properties → surgealert.sensor.depth-m →
    // SENSOR_DEPTH_M in .env
    @Value("${surgealert.sensor.depth-m:6.1}")
    private double sensorDepthM;

    @Value("${surgealert.thresholds.yellow:3.50}")
    private double yellowThreshold;

    @Value("${surgealert.thresholds.orange:4.50}")
    private double orangeThreshold;

    @Value("${surgealert.thresholds.red:5.50}")
    private double redThreshold;

    public SensorDataService(SensorDataRepository sensorDataRepository,
            TideMetricsRepository tideMetricsRepository,
            WeatherMetricsRepository weatherMetricsRepository,
            MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository) {
        this.sensorDataRepository = sensorDataRepository;
        this.tideMetricsRepository = tideMetricsRepository;
        this.weatherMetricsRepository = weatherMetricsRepository;
        this.mlFeaturesRealtimeRepository = mlFeaturesRealtimeRepository;
    }

    public SensorData saveSensorData(SensorDataDTO dto) {
        // --- DATA GUARD: REJECT GHOST VALUES / NOISE ---
        if (dto.getWaterLevelM() != null && dto.getWaterLevelM() < 0.30) {
            System.out.println(" [DATA GUARD] Blocking ghost value: " + dto.getWaterLevelM() + "m");
            return null;
        }

        LocalDateTime now = dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now();

        // 1. SAVE CORE SENSOR DATA (Skip if Simulated)
        SensorData savedSensor = null;
        if (dto.getIsSimulated() != null && dto.getIsSimulated()) {
            System.out.println(" [DATA GUARD] Skipping simulated sensor data save.");
        } else {
            SensorData sensorData = new SensorData();
            sensorData.setTimestamp(now);
            sensorData.setWaterLevelM(dto.getWaterLevelM());
            sensorData.setSensorFlowRateMps(dto.getSensorFlowRateMps());
            sensorData.setImageFlowRateMps(dto.getImageFlowRateMps());
            sensorData.setImageRiseRateMps(dto.getImageRiseRateMps());
            sensorData.setSensorRiseRate(dto.getSensorRiseRate());

            if (dto.getSnapshotBase64() != null && !dto.getSnapshotBase64().isEmpty()) {
                try {
                    byte[] imageBytes = java.util.Base64.getDecoder().decode(dto.getSnapshotBase64());
                    sensorData.setImageBytes(imageBytes);
                } catch (Exception e) {
                    System.err.println(" [Storage] Failed to decode image base64: " + e.getMessage());
                }
            }

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

            savedSensor = sensorDataRepository.save(sensorData);
        }

        // 2. SAVE TIDE METRICS (Only if not recently saved by Scheduler to avoid
        // duplicates)
        if (dto.getTideHeightM() != null) {
            boolean exists = tideMetricsRepository.findFirstByOrderByTimestampDesc()
                    .map(t -> t.getTimestamp().isAfter(now.minusMinutes(1))).orElse(false);
            if (!exists) {
                TideMetrics tide = new TideMetrics();
                tide.setTimestamp(now);
                tide.setTideHeightM(dto.getTideHeightM());
                tide.setTideTrend(dto.getTideTrend());
                tideMetricsRepository.save(tide);
            }
        }

        // 3. SAVE WEATHER METRICS (Only if not recently saved by Scheduler)
        if (dto.getRainMm() != null || dto.getMarulasRainMm() != null) {
            boolean exists = weatherMetricsRepository.findFirstByTimestampBeforeOrderByTimestampDesc(now.plusMinutes(1))
                    .map(w -> w.getTimestamp().isAfter(now.minusMinutes(1))).orElse(false);
            if (!exists) {
                WeatherMetrics weather = new WeatherMetrics();
                weather.setTimestamp(now);
                weather.setQcRainMm(dto.getRainMm());
                weather.setMarulasRainMm(dto.getMarulasRainMm());
                weather.setMar24hrSum(dto.getMar24hrSum());
                weather.setPressureHpa(dto.getPressureHpa());
                weather.setWindSpeed(dto.getWindSpeedKph());
                weather.setSoilMoisture(dto.getSoilMoisturePct());
                weatherMetricsRepository.save(weather);
            }
        }

        // 4. SAVE ML FEATURES REALTIME (All calculated features)
        MLFeaturesRealtime ml = new MLFeaturesRealtime();
        ml.setTimestamp(now);
        ml.setWaterLevel(dto.getWaterLevelM());
        ml.setRiseRate(dto.getImageRiseRateMps());
        ml.setSensorRiseRate(dto.getSensorRiseRate());

        ml.setTideHeightM(dto.getTideHeightM());
        ml.setTideTrend(dto.getTideTrend());

        ml.setQcRainMm(dto.getRainMm());
        ml.setQcLag1Mm(dto.getQcLag1());
        ml.setQcLag2Mm(dto.getQcLag2());
        ml.setQc3hrSum(dto.getQc3hrSum());
        ml.setQc6hrSum(dto.getQc6hrSum());

        ml.setMarulasRainMm(dto.getMarulasRainMm());
        ml.setMarLag1Mm(dto.getMarLag1());
        ml.setMarLag2Mm(dto.getMarLag2());
        ml.setMar3hrSum(dto.getMar3hrSum());
        ml.setMar6hrSum(dto.getMar6hrSum());
        ml.setMar24hrSum(dto.getMar24hrSum());

        ml.setPressureHpa(dto.getPressureHpa());
        ml.setPressTrend(dto.getPressTrend());

        ml.setWindSpeed(dto.getWindSpeedKph());
        ml.setWindSin(dto.getWindSin());
        ml.setWindCos(dto.getWindCos());

        ml.setSoilMoisture(dto.getSoilMoisturePct());
        ml.setPredictedAlertClass(dto.getPredictedAlertClass());
        mlFeaturesRealtimeRepository.save(ml);

        return savedSensor;
    }

    public SensorDataDTO getLatestSensorData() {
        LocalDateTime now = LocalDateTime.now(java.time.ZoneId.of("Asia/Manila"));
        return sensorDataRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now)
                .map(sd -> {
                    SensorDataDTO dto = convertToDTO(sd);

                    // Merge latest ML classification and features
                    mlFeaturesRealtimeRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(now).ifPresent(m -> {
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
                        dto.setMar6hrSum(m.getMar6hrSum());
                        dto.setPressTrend(m.getPressTrend());
                    });

                    // Add simulated image fallback logic
                    if (dto.getSnapshotBase64() == null || dto.getSnapshotBase64().isEmpty() || dto.getSnapshotBase64().startsWith("b'0x")) {
                        String imgBase64 = loadSimulatedImage(dto.getCurrentAlertLevel());
                        if (imgBase64 != null) {
                            dto.setSnapshotBase64(imgBase64);
                        }
                    }

                    return dto;
                })
                .orElse(null);
    }

    public List<SensorDataDTO> getRecentSensorData(int hours) {
        LocalDateTime now = LocalDateTime.now(java.time.ZoneId.of("Asia/Manila"));
        LocalDateTime since = now.minusHours(hours);
        
        // 1. Fetch core sensor data in the last X hours, but exclude future simulation data
        List<SensorData> coreData = sensorDataRepository.findByTimestampBetween(since, now);
        
        // Sort DESC for frontend
        coreData.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));

        // 2. Fetch environmental features for the same window
        List<MLFeaturesRealtime> mlList = mlFeaturesRealtimeRepository.findByTimestampBetween(since, now);

        return coreData.stream().map(sd -> {
            SensorDataDTO dto = convertToDTO(sd);
            LocalDateTime ts = sd.getTimestamp();

            // Find closest match (within 30 seconds) for environmental data
            mlList.stream()
                .filter(m -> Math.abs(java.time.Duration.between(m.getTimestamp(), ts).getSeconds()) <= 30)
                .findFirst().ifPresent(m -> {
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
                    dto.setMar6hrSum(m.getMar6hrSum());
                    dto.setPressTrend(m.getPressTrend());
                });

            return dto;
        }).collect(Collectors.toList());
    }

    private SensorDataDTO convertToDTO(SensorData sensorData) {
        SensorDataDTO dto = new SensorDataDTO();
        dto.setId(sensorData.getId());
        dto.setTimestamp(sensorData.getTimestamp());
        dto.setWaterLevelM(sensorData.getWaterLevelM());
        dto.setSensorFlowRateMps(sensorData.getSensorFlowRateMps());
        dto.setImageFlowRateMps(sensorData.getImageFlowRateMps());
        dto.setImageRiseRateMps(sensorData.getImageRiseRateMps());
        dto.setSensorRiseRate(sensorData.getSensorRiseRate());
        dto.setCurrentAlertLevel(sensorData.getCurrentAlertLevel());

        if (sensorData.getImageBytes() != null) {
            dto.setSnapshotBase64(java.util.Base64.getEncoder().encodeToString(sensorData.getImageBytes()));
        }

        // Return Prediction Data
        dto.setPredictedLevel(sensorData.getPredictedLevel());
        dto.setPredictedAlertLevel(sensorData.getPredictedAlertLevel());

        return dto;
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
}