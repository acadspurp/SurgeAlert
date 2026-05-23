package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.surgealert.dto.TideResponse;
import com.surgealert.entity.TideMetrics;
import com.surgealert.entity.WeatherMetrics;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import jakarta.annotation.PostConstruct;

@Service
public class DataCollectionScheduler {

    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");

    private final ExternalApiService externalApiService;
    private final TideMetricsRepository tideRepository;
    private final WeatherMetricsRepository weatherRepository;
    private final MlFeaturesFromMetricsService mlFeaturesFromMetricsService;

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
                                   MlFeaturesFromMetricsService mlFeaturesFromMetricsService) {
        this.externalApiService = externalApiService;
        this.tideRepository = tideRepository;
        this.weatherRepository = weatherRepository;
        this.mlFeaturesFromMetricsService = mlFeaturesFromMetricsService;
    }

    /**
     * STARTUP TASK — Runs once immediately when the backend boots.
     *
     * Always fetches weather data (hourly, so always stale on restart).
     * For tides: checks if TODAY's data already exists in the DB.
     *   - If missing → fetch immediately (covers missed schedules / Render sleep).
     *   - If present → skip to avoid redundant API calls.
     */
    @PostConstruct
    public void onStartup() {
        System.out.println("[Scheduler] Backend started — checking tide + weather data.");

        // Always refresh weather (it's hourly, so it's always stale after a restart)
        performWeatherFetch();

        // Fetch tides if today's data is absent or the last fetch was unsuccessful
        LocalDateTime todayStart = LocalDateTime.now(MANILA).withHour(0).withMinute(0).withSecond(0).withNano(0);
        boolean hasTodayData = tideRepository.existsByTimestamp(todayStart)
                || tideRepository.findByTimestampAfter(todayStart).size() > 0;

        if (!hasTodayData || !tideFetchSuccess) {
            System.out.println("[Scheduler] Tide data missing or stale — fetching now.");
            tideFetchSuccess = performTideFetch();
        } else {
            System.out.println("[Scheduler] Tide data already present for today — skipping startup fetch.");
        }

        mlFeaturesFromMetricsService.syncLatestFromMetricsTables();
    }

    /**
     * TIDE COLLECTION TASK
     * Runs every 24 hours at midnight.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void dailyTideFetch() {
        System.out.println(" [Scheduler] Starting daily Tide fetch...");
        tideFetchSuccess = performTideFetch();
        mlFeaturesFromMetricsService.syncLatestFromMetricsTables();
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
        System.out.println(" [Scheduler] Starting hourly weather_metrics fetch...");
        performWeatherFetch();
    }

    /**
     * Rebuild ml_features_realtime from DB tables shortly after each weather hour.
     */
    @Scheduled(cron = "0 5 * * * *")
    public void hourlyMlFeaturesFromMetrics() {
        System.out.println(" [Scheduler] Syncing ml_features_realtime from weather_metrics + tide_metrics...");
        mlFeaturesFromMetricsService.syncLatestFromMetricsTables();
    }

    private boolean performTideFetch() {
        TideResponse response = externalApiService.fetchTideData();
        if (response == null || response.getError() != null || response.getHeights() == null) {
            return false;
        }

        double prevHeight = 0.0;
        for (TideResponse.TideHeight th : response.getHeights()) {
            if (th == null) continue;
            LocalDateTime dt = LocalDateTime.ofInstant(java.time.Instant.ofEpochSecond(th.getDt()),
                    java.time.ZoneId.of("Asia/Manila"));
            
            // Avoid duplicate entries for the same hour (Check +/- 5 minutes)
            LocalDateTime startOfHour = dt.withMinute(0).withSecond(0).withNano(0);
            if (tideRepository.existsByTimestamp(dt) || tideRepository.existsByTimestamp(startOfHour)) continue;

            TideMetrics tm = new TideMetrics();
            tm.setTimestamp(dt != null ? dt : LocalDateTime.now(java.time.ZoneId.of("Asia/Manila")));
            tm.setTideHeightM(th.getHeight());
            tm.setTideTrend(th.getHeight() - prevHeight);
            tideRepository.save(tm);
            prevHeight = th.getHeight();
        }
        return true;
    }

    private void performWeatherFetch() {
        JsonNode qcData = externalApiService.fetchWeatherAt(qcLat, qcLon);
        JsonNode marData = externalApiService.fetchWeatherAt(marLat, marLon);

        if (qcData == null || marData == null) {
            System.err.println(" [Scheduler] Weather API returned no data — weather_metrics not updated.");
            return;
        }

        LocalDateTime now = LocalDateTime.now(MANILA).withMinute(0).withSecond(0).withNano(0);
        int hourIdx = now.getHour();

        try {
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
            weather.setWindDirectionDeg(windDir);
            weather.setSoilMoisture(soilMoisture);

            double mar24h = 0;
            for (int i = 0; i < 24; i++) {
                mar24h += marData.get("hourly").get("precipitation").get(i).asDouble();
            }
            weather.setMar24hrSum(mar24h);
            weatherRepository.save(weather);
            System.out.println(" [Scheduler] weather_metrics row saved @ " + now);

            mlFeaturesFromMetricsService.syncFromMetricsTables(now);
        } catch (Exception e) {
            System.err.println(" [Scheduler] Weather fetch error: " + e.getMessage());
        }
    }
}
