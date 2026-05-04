package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.surgealert.dto.TideResponse;
import com.surgealert.entity.MLFeaturesRealtime;
import com.surgealert.entity.TideMetrics;
import com.surgealert.entity.WeatherMetrics;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Service
public class DataCollectionScheduler {

    private final ExternalApiService externalApiService;
    private final TideMetricsRepository tideRepository;
    private final WeatherMetricsRepository weatherRepository;
    private final MLFeaturesRealtimeRepository mlRepository;

    @Value("${surgealert.coords.qc.lat:14.7153}")
    private double qcLat;
    @Value("${surgealert.coords.qc.lon:121.0667}")
    private double qcLon;
    
    @Value("${surgealert.coords.mar.lat:14.6773}")
    private double marLat;
    @Value("${surgealert.coords.mar.lon:120.9842}")
    private double marLon;

    private boolean tideFetchSuccess = false;

    public DataCollectionScheduler(ExternalApiService externalApiService,
                                   TideMetricsRepository tideRepository,
                                   WeatherMetricsRepository weatherRepository,
                                   MLFeaturesRealtimeRepository mlRepository) {
        this.externalApiService = externalApiService;
        this.tideRepository = tideRepository;
        this.weatherRepository = weatherRepository;
        this.mlRepository = mlRepository;
    }

    /**
     * TIDE COLLECTION TASK
     * Runs every 24 hours at midnight.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void dailyTideFetch() {
        System.out.println(" [Scheduler] Starting daily Tide fetch...");
        tideFetchSuccess = performTideFetch();
    }

    /**
     * TIDE RETRY TASK
     * Runs every 3 hours. If the daily fetch failed, it retries until it gets data.
     */
    @Scheduled(fixedRate = 10800000) // 3 Hours
    public void retryTideFetch() {
        if (!tideFetchSuccess) {
            System.out.println(" [Scheduler] Retrying Tide fetch (Last attempt failed)...");
            tideFetchSuccess = performTideFetch();
        }
    }

    /**
     * WEATHER COLLECTION TASK
     * Runs every hour on the hour.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void hourlyWeatherFetch() {
        System.out.println(" [Scheduler] Starting hourly Weather and ML Feature processing...");
        performWeatherAndMlFetch();
    }

    private boolean performTideFetch() {
        TideResponse response = externalApiService.fetchTideData();
        if (response == null || response.getError() != null || response.getHeights() == null) {
            return false;
        }

        double prevHeight = 0.0;
        for (TideResponse.TideHeight th : response.getHeights()) {
            LocalDateTime dt = LocalDateTime.ofInstant(java.time.Instant.ofEpochSecond(th.getDt()), 
                                                      java.time.ZoneId.of("Asia/Manila"));
            
            // Avoid duplicate entries for the same hour (Check +/- 5 minutes)
            LocalDateTime startOfHour = dt.withMinute(0).withSecond(0).withNano(0);
            if (tideRepository.existsByTimestamp(dt) || tideRepository.existsByTimestamp(startOfHour)) continue;

            TideMetrics tm = new TideMetrics();
            tm.setTimestamp(dt);
            tm.setTideHeightM(th.getHeight());
            tm.setTideTrend(th.getHeight() - prevHeight);
            tideRepository.save(tm);
            prevHeight = th.getHeight();
        }
        return true;
    }

    private void performWeatherAndMlFetch() {
        // 1. Fetch QC Weather (La Mesa) and Marulas Weather using configured coordinates
        JsonNode qcData = externalApiService.fetchWeatherAt(qcLat, qcLon);
        JsonNode marData = externalApiService.fetchWeatherAt(marLat, marLon);

        if (qcData == null || marData == null) return;

        LocalDateTime now = LocalDateTime.now();
        int hourIdx = now.getHour();

        try {
            // --- WEATHER METRICS ---
            WeatherMetrics weather = new WeatherMetrics();
            weather.setTimestamp(now);
            
            double qcRain = qcData.get("hourly").get("precipitation").get(hourIdx).asDouble();
            double marRain = marData.get("hourly").get("precipitation").get(hourIdx).asDouble();
            double pressure = marData.get("hourly").get("surface_pressure").get(hourIdx).asDouble();
            double windSpeed = marData.get("hourly").get("wind_speed_10m").get(hourIdx).asDouble();
            double windDir = marData.get("hourly").get("wind_direction_10m").get(hourIdx).asDouble();
            double soilMoisture = marData.get("hourly").get("soil_moisture_0_to_7cm").get(hourIdx).asDouble();

            weather.setQcRainMm(qcRain);
            weather.setMarulasRainMm(marRain);
            weather.setPressureHpa(pressure);
            weather.setWindSpeed(windSpeed);
            weather.setSoilMoisture(soilMoisture);
            
            double mar24h = 0;
            for(int i=0; i<24; i++) mar24h += marData.get("hourly").get("precipitation").get(i).asDouble();
            weather.setMar24hrSum(mar24h);
            weatherRepository.save(weather);

            // --- ML FEATURES REALTIME (Targeted Columns Only) ---
            MLFeaturesRealtime ml = new MLFeaturesRealtime();
            ml.setTimestamp(now);
            ml.setMonth(now.getMonthValue());
            ml.setHour(now.getHour());

            ml.setQcRainMm(qcRain);
            ml.setQcLag1Mm(getRainfallAt(now.minusHours(1), "QC"));
            ml.setQcLag2Mm(getRainfallAt(now.minusHours(2), "QC"));
            ml.setQc3hrSum(getRainfallSum(now, 3, "QC"));
            ml.setQc6hrSum(getRainfallSum(now, 6, "QC"));

            ml.setMarulasRainMm(marRain);
            ml.setMarLag1Mm(getRainfallAt(now.minusHours(1), "MARULAS"));
            ml.setMarLag2Mm(getRainfallAt(now.minusHours(2), "MARULAS"));
            ml.setMar3hrSum(getRainfallSum(now, 3, "MARULAS"));
            ml.setMar24hrSum(mar24h);

            ml.setPressureHpa(pressure);
            
            // Calculate Pressure Trend (Current - Last Hour)
            Double lastPressure = weatherRepository.findFirstByTimestampBeforeOrderByTimestampDesc(now.minusMinutes(30))
                    .map(WeatherMetrics::getPressureHpa).orElse(pressure);
            ml.setPressTrend(pressure - lastPressure);

            ml.setWindSpeed(windSpeed);
            ml.setSoilMoisture(soilMoisture);

            double rad = Math.toRadians(windDir);
            ml.setWindSin(Math.sin(rad));
            ml.setWindCos(Math.cos(rad));

            tideRepository.findFirstByOrderByTimestampDesc().ifPresent(t -> {
                ml.setTideHeightM(t.getTideHeightM());
                ml.setTideTrend(t.getTideTrend());
            });

            mlRepository.save(ml);
            System.out.println(" [Scheduler] ML Features table updated.");
        } catch (Exception e) {
            System.err.println(" [Scheduler] Error: " + e.getMessage());
        }
    }

    private Double getRainfallAt(LocalDateTime time, String location) {
        return weatherRepository.findFirstByTimestampBeforeOrderByTimestampDesc(time)
                .map(w -> location.equals("QC") ? w.getQcRainMm() : w.getMarulasRainMm())
                .orElse(0.0);
    }

    private Double getRainfallSum(LocalDateTime now, int hours, String location) {
        LocalDateTime start = now.minusHours(hours);
        List<WeatherMetrics> recent = weatherRepository.findByTimestampAfter(start);
        return recent.stream()
                .mapToDouble(w -> location.equals("QC") ? (w.getQcRainMm() != null ? w.getQcRainMm() : 0.0) : (w.getMarulasRainMm() != null ? w.getMarulasRainMm() : 0.0))
                .sum();
    }
}
