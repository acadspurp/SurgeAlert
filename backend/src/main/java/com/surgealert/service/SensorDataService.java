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
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private final SensorDataRepository sensorDataRepository;
    private final TideMetricsRepository tideMetricsRepository;
    private final WeatherMetricsRepository weatherMetricsRepository;
    private final MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository;

    // Reads from application.properties → surgealert.sensor.depth-m → SENSOR_DEPTH_M in .env
    @Value("${surgealert.sensor.depth-m:6.1}")
    private double sensorDepthM;

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
            sensorData.setImageBase64(dto.getSnapshotBase64());

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

        // 2. SAVE TIDE METRICS (Raw only + Trend as requested)
        if (dto.getTideHeightM() != null) {
            TideMetrics tide = new TideMetrics();
            tide.setTimestamp(now);
            tide.setTideHeightM(dto.getTideHeightM());
            tide.setTideTrend(dto.getTideTrend());
            tideMetricsRepository.save(tide);
        }

        // 3. SAVE WEATHER METRICS (Raw only)
        if (dto.getRainMm() != null || dto.getMarulasRainMm() != null) {
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
        return sensorDataRepository.findFirstByOrderByTimestampDesc()
                .map(sd -> {
                    SensorDataDTO dto = convertToDTO(sd);
                    
                    // Merge latest Tide info
                    tideMetricsRepository.findFirstByOrderByTimestampDesc().ifPresent(t -> {
                        dto.setTideHeightM(t.getTideHeightM());
                    });
                    
                    // Merge latest Weather info
                    weatherMetricsRepository.findFirstByOrderByTimestampDesc().ifPresent(w -> {
                        dto.setRainMm(w.getQcRainMm());
                        dto.setMarulasRainMm(w.getMarulasRainMm());
                        dto.setMar24hrSum(w.getMar24hrSum());
                        dto.setPressureHpa(w.getPressureHpa());
                        dto.setWindSpeedKph(w.getWindSpeed());
                        dto.setSoilMoisturePct(w.getSoilMoisture());
                    });

                    // Merge latest ML classification and features if needed
                    mlFeaturesRealtimeRepository.findFirstByOrderByTimestampDesc().ifPresent(m -> {
                        dto.setPredictedAlertClass(m.getPredictedAlertClass());
                        dto.setQcLag1(m.getQcLag1Mm());
                        dto.setQcLag2(m.getQcLag2Mm());
                        dto.setMarLag1(m.getMarLag1Mm());
                        dto.setMarLag2(m.getMarLag2Mm());
                        dto.setMar3hrSum(m.getMar3hrSum());
                        dto.setMar6hrSum(m.getMar6hrSum());
                    });
                    
                    return dto;
                })
                .orElse(null);
    }

    public List<SensorDataDTO> getRecentSensorData(int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return sensorDataRepository.findRecentData(since).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
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
        dto.setSnapshotBase64(sensorData.getImageBase64());

        // Return Prediction Data
        dto.setPredictedLevel(sensorData.getPredictedLevel());
        dto.setPredictedAlertLevel(sensorData.getPredictedAlertLevel());

        return dto;
    }

    // Fallback alert classifier — used only when the Edge system is offline.
    // Thresholds are derived from sensorDepthM which comes from SENSOR_DEPTH_M in .env.
    // Mirrors the ratios in: EdgeSystem/config/settings.py and ConfigController.java
    private String calculateFallbackAlertLevel(Double waterLevel) {
        if (waterLevel == null) return "GREEN";
        if (waterLevel >= sensorDepthM * 0.98) return "CRITICAL"; // Overflow imminent
        if (waterLevel >= sensorDepthM * 0.90) return "RED";      // ~5.49 m at 6.1 m depth
        if (waterLevel >= sensorDepthM * 0.74) return "ORANGE";   // ~4.51 m
        if (waterLevel >= sensorDepthM * 0.57) return "YELLOW";   // ~3.48 m
        return "GREEN";
    }
}