package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.surgealert.dto.TideResponse;
import com.surgealert.dto.WeatherCachePayload;
import com.surgealert.entity.TideMetrics;
import com.surgealert.entity.WeatherMetrics;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
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

    private boolean tideFetchSuccess = false;
    private boolean weatherFetchSuccess = false;

    public DataCollectionScheduler(ExternalApiService externalApiService,
                                   TideMetricsRepository tideRepository,
                                   WeatherMetricsRepository weatherRepository,
                                   MlFeaturesFromMetricsService mlFeaturesFromMetricsService) {
        this.externalApiService = externalApiService;
        this.tideRepository = tideRepository;
        this.weatherRepository = weatherRepository;
        this.mlFeaturesFromMetricsService = mlFeaturesFromMetricsService;
    }

    @PostConstruct
    public void onStartup() {
        System.out.println("[Scheduler] Backend started — checking tide + weather data.");

        if (!externalApiService.hasTodayWeatherCache() || !weatherCacheStillFresh()) {
            System.out.println("[Scheduler] Weather cache missing or stale — fetching now.");
            weatherFetchSuccess = externalApiService.refreshWeatherCache() != null;
        } else {
            System.out.println("[Scheduler] Weather cache present for today — skipping startup fetch.");
            weatherFetchSuccess = true;
        }
        syncWeatherMetricsFromCache();

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

    @Scheduled(cron = "0 0 0 * * *")
    public void dailyTideFetch() {
        System.out.println(" [Scheduler] Starting daily Tide fetch...");
        tideFetchSuccess = performTideFetch();
        mlFeaturesFromMetricsService.syncLatestFromMetricsTables();
    }

    @Scheduled(fixedRate = 10800000)
    public void retryTideFetch() {
        if (!tideFetchSuccess) {
            System.out.println(" [Scheduler] Retrying Tide fetch (Last attempt failed)...");
            tideFetchSuccess = performTideFetch();
        }
    }

    /** Refresh Open-Meteo forecast bundle every 3 days at Manila midnight. */
    @Scheduled(cron = "0 0 0 */3 * *")
    public void scheduledWeatherCacheRefresh() {
        System.out.println(" [Scheduler] Starting scheduled weather cache refresh...");
        weatherFetchSuccess = externalApiService.refreshWeatherCache() != null;
        syncWeatherMetricsFromCache();
        mlFeaturesFromMetricsService.syncLatestFromMetricsTables();
    }

    /** Retry failed weather fetch once per day. */
    @Scheduled(fixedRate = 86400000)
    public void retryWeatherFetch() {
        if (!weatherFetchSuccess) {
            System.out.println(" [Scheduler] Retrying weather cache fetch (last attempt failed)...");
            weatherFetchSuccess = externalApiService.refreshWeatherCache() != null;
            if (weatherFetchSuccess) {
                syncWeatherMetricsFromCache();
            }
        }
    }

    /** Hourly: update weather_metrics from cache only (no live Open-Meteo calls). */
    @Scheduled(cron = "0 0 * * * *")
    public void hourlyWeatherMetricsFromCache() {
        syncWeatherMetricsFromCache();
    }

    @Scheduled(cron = "0 5 * * * *")
    public void hourlyMlFeaturesFromMetrics() {
        System.out.println(" [Scheduler] Syncing ml_features_realtime from weather_metrics + tide_metrics...");
        mlFeaturesFromMetricsService.syncLatestFromMetricsTables();
    }

    private boolean weatherCacheStillFresh() {
        return externalApiService.getLatestWeatherCachePayload().isPresent();
    }

    private boolean performTideFetch() {
        TideResponse response = externalApiService.fetchTideData();
        if (response == null || response.getError() != null || response.getHeights() == null) {
            return false;
        }

        double prevHeight = 0.0;
        for (TideResponse.TideHeight th : response.getHeights()) {
            if (th == null) continue;
            LocalDateTime dt = LocalDateTime.ofInstant(java.time.Instant.ofEpochSecond(th.getDt()), MANILA);

            LocalDateTime startOfHour = dt.withMinute(0).withSecond(0).withNano(0);
            if (tideRepository.existsByTimestamp(dt) || tideRepository.existsByTimestamp(startOfHour)) continue;

            TideMetrics tm = new TideMetrics();
            tm.setTimestamp(dt != null ? dt : LocalDateTime.now(MANILA));
            tm.setTideHeightM(th.getHeight());
            tm.setTideTrend(th.getHeight() - prevHeight);
            tideRepository.save(tm);
            prevHeight = th.getHeight();
        }
        return true;
    }

    private void syncWeatherMetricsFromCache() {
        Optional<WeatherCachePayload> cacheOpt = externalApiService.getLatestWeatherCachePayload();
        if (cacheOpt.isEmpty()) {
            if (!externalApiService.hasTodayWeatherCache()) {
                System.out.println(" [Scheduler] No weather cache — attempting refresh before metrics sync.");
                weatherFetchSuccess = externalApiService.refreshWeatherCache() != null;
                cacheOpt = externalApiService.getLatestWeatherCachePayload();
            }
            if (cacheOpt.isEmpty()) {
                System.err.println(" [Scheduler] Weather cache unavailable — weather_metrics not updated.");
                return;
            }
        }

        JsonNode qcData = cacheOpt.get().getQcHourly();
        JsonNode marData = cacheOpt.get().getMarHourly();
        if (qcData == null || marData == null) {
            System.err.println(" [Scheduler] Weather cache missing hourly JSON — weather_metrics not updated.");
            return;
        }

        LocalDateTime now = LocalDateTime.now(MANILA).withMinute(0).withSecond(0).withNano(0);
        int hourIdx = resolveHourlyIndex(marData.path("hourly"), now);
        if (hourIdx < 0) {
            hourIdx = Math.min(now.getHour(), marData.path("hourly").path("precipitation").size() - 1);
        }

        try {
            JsonNode qcHourly = qcData.get("hourly");
            JsonNode marHourly = marData.get("hourly");

            WeatherMetrics weather = new WeatherMetrics();
            weather.setTimestamp(now);

            double qcRain = qcHourly.get("precipitation").get(hourIdx).asDouble();
            double marRain = marHourly.get("precipitation").get(hourIdx).asDouble();
            double pressure = marHourly.get("surface_pressure").get(hourIdx).asDouble();
            double windSpeed = marHourly.get("wind_speed_10m").get(hourIdx).asDouble();
            double windDir = marHourly.path("wind_direction_10m").size() > hourIdx
                    ? marHourly.get("wind_direction_10m").get(hourIdx).asDouble()
                    : 0.0;
            double soilMoisture = qcHourly.path("soil_moisture_0_to_7cm").size() > hourIdx
                    ? qcHourly.get("soil_moisture_0_to_7cm").get(hourIdx).asDouble()
                    : 0.0;

            weather.setQcRainMm(qcRain);
            weather.setMarulasRainMm(marRain);
            weather.setPressureHpa(pressure);
            weather.setWindSpeed(windSpeed);
            weather.setWindDirectionDeg(windDir);
            weather.setSoilMoisture(soilMoisture);

            double mar24h = 0;
            int limit = Math.min(24, marHourly.get("precipitation").size());
            for (int i = 0; i < limit; i++) {
                mar24h += marHourly.get("precipitation").get(i).asDouble();
            }
            weather.setMar24hrSum(mar24h);
            weatherRepository.save(weather);
            System.out.println(" [Scheduler] weather_metrics row saved from cache @ " + now);

            mlFeaturesFromMetricsService.syncFromMetricsTables(now);
        } catch (Exception e) {
            System.err.println(" [Scheduler] Weather metrics sync error: " + e.getMessage());
        }
    }

    private int resolveHourlyIndex(JsonNode hourly, LocalDateTime targetHour) {
        if (hourly == null || !hourly.has("time") || !hourly.get("time").isArray()) {
            return -1;
        }
        String needle = targetHour.withMinute(0).withSecond(0).withNano(0).toString().substring(0, 13);
        for (int i = 0; i < hourly.get("time").size(); i++) {
            String slot = hourly.get("time").get(i).asText();
            if (slot.startsWith(needle)) {
                return i;
            }
        }
        return -1;
    }
}
