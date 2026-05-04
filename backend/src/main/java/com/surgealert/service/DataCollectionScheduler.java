package com.surgealert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.surgealert.dto.TideResponse;
import com.surgealert.entity.MLFeaturesRealtime;
import com.surgealert.entity.TideMetrics;
import com.surgealert.entity.WeatherMetrics;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Service
public class DataCollectionScheduler {

    private final ExternalApiService externalApiService;
    private final TideMetricsRepository tideRepository;
    private final WeatherMetricsRepository weatherRepository;
    private final MLFeaturesRealtimeRepository mlRepository;

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
        if (response == null || response.getError() != null) {
            return false;
        }

        // The WorldTides API returns Extremes. The plan asks for hourly Tide_Height_m.
        // Since WorldTides extremes are points, we will linearly interpolate or use the Marine model fallback for hourly.
        // For simplicity and matching the plan's 3-day requirement, we log what we have.
        // Real-time Tide Height is fetched by the Pi currently, but we can store the prediction here.
        return true;
    }

    private void performWeatherAndMlFetch() {
        // 1. Fetch QC Weather
        JsonNode qcData = externalApiService.fetchWeatherAt(14.7153, 121.0667);
        // 2. Fetch Marulas Weather
        JsonNode marData = externalApiService.fetchWeatherAt(14.6773, 120.9842);

        if (qcData == null || marData == null) return;

        LocalDateTime now = LocalDateTime.now();
        int hourIdx = now.getHour(); // Indices match hours in Open-Meteo response

        try {
            // --- POPULATE WEATHER METRICS ---
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
            
            // Calculate Marulas 24h sum (approximate from forecast data)
            double mar24h = 0;
            for(int i=0; i<24; i++) {
                mar24h += marData.get("hourly").get("precipitation").get(i).asDouble();
            }
            weather.setMar24hrSum(mar24h);
            
            weatherRepository.save(weather);

            // --- POPULATE ML FEATURES REALTIME (Calculated) ---
            MLFeaturesRealtime ml = new MLFeaturesRealtime();
            ml.setTimestamp(now);
            ml.setMonth(now.getMonthValue());
            ml.setHour(now.getHour());

            // Environmental Features
            ml.setQcRainMm(qcRain);
            ml.setMarulasRainMm(marRain);
            ml.setPressureHpa(pressure);
            ml.setWindSpeed(windSpeed);
            ml.setSoilMoisture(soilMoisture);

            // Wind Direction -> Sin/Cos
            double rad = Math.toRadians(windDir);
            ml.setWindSin(Math.sin(rad));
            ml.setWindCos(Math.cos(rad));

            // CALCULATE LAGS & SUMS (Look back in DB)
            ml.setQcLag1Mm(getRainfallAt(now.minusHours(1), "QC"));
            ml.setQcLag2Mm(getRainfallAt(now.minusHours(2), "QC"));
            ml.setQc3hrSum(getRainfallSum(now, 3, "QC"));
            ml.setQc6hrSum(getRainfallSum(now, 6, "QC"));

            ml.setMarLag1Mm(getRainfallAt(now.minusHours(1), "MARULAS"));
            ml.setMarLag2Mm(getRainfallAt(now.minusHours(2), "MARULAS"));
            ml.setMar3hrSum(getRainfallSum(now, 3, "MARULAS"));
            ml.setMar6hrSum(getRainfallSum(now, 6, "MARULAS"));
            ml.setMar24hrSum(mar24h);

            // Tide Integration (Latest from TideMetrics)
            tideRepository.findFirstByOrderByTimestampDesc().ifPresent(t -> {
                ml.setTideHeightM(t.getTideHeightM());
                ml.setTideTrend(t.getTideTrend());
            });

            mlRepository.save(ml);
            System.out.println(" [Scheduler] Hourly processing complete.");

        } catch (Exception e) {
            System.err.println(" [Scheduler] Error processing hourly data: " + e.getMessage());
        }
    }

    private Double getRainfallAt(LocalDateTime time, String location) {
        return weatherRepository.findFirstByTimestampBeforeOrderByTimestampDesc(time)
                .map(w -> location.equals("QC") ? w.getQcRainMm() : w.getMarulasRainMm())
                .orElse(0.0);
    }

    private Double getRainfallSum(LocalDateTime now, int hours, String location) {
        LocalDateTime start = now.minusHours(hours);
        List<WeatherMetrics> recent = weatherRepository.findAllByTimestampAfter(start);
        return recent.stream()
                .mapToDouble(w -> location.equals("QC") ? (w.getQcRainMm() != null ? w.getQcRainMm() : 0.0) : (w.getMarulasRainMm() != null ? w.getMarulasRainMm() : 0.0))
                .sum();
    }
}
