package com.surgealert.service;

import com.surgealert.entity.MLFeaturesRealtime;
import com.surgealert.entity.TideMetrics;
import com.surgealert.entity.WeatherMetrics;
import com.surgealert.repository.MLFeaturesRealtimeRepository;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * Builds {@code ml_features_realtime} from persisted {@code weather_metrics} and {@code tide_metrics}.
 * External APIs write the metric tables; this service is the only writer for ML features.
 */
@Service
public class MlFeaturesFromMetricsService {

    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");

    private final WeatherMetricsRepository weatherRepository;
    private final TideMetricsRepository tideRepository;
    private final MLFeaturesRealtimeRepository mlRepository;

    public MlFeaturesFromMetricsService(WeatherMetricsRepository weatherRepository,
                                        TideMetricsRepository tideRepository,
                                        MLFeaturesRealtimeRepository mlRepository) {
        this.weatherRepository = weatherRepository;
        this.tideRepository = tideRepository;
        this.mlRepository = mlRepository;
    }

    /**
     * Rebuild ML features for the current hour from the latest rows in weather_metrics + tide_metrics.
     *
     * @return saved row, or empty if weather_metrics has no data yet
     */
    @Transactional
    public Optional<MLFeaturesRealtime> syncLatestFromMetricsTables() {
        LocalDateTime anchor = LocalDateTime.now(MANILA).withMinute(0).withSecond(0).withNano(0);
        return syncFromMetricsTables(anchor);
    }

    @Transactional
    public Optional<MLFeaturesRealtime> syncFromMetricsTables(LocalDateTime anchor) {
        Optional<WeatherMetrics> weatherOpt = weatherRepository
                .findFirstByTimestampLessThanEqualOrderByTimestampDesc(anchor);
        if (weatherOpt.isEmpty()) {
            System.out.println(" [ML Sync] Skipped — no weather_metrics row at or before " + anchor);
            return Optional.empty();
        }

        WeatherMetrics weather = weatherOpt.get();
        MLFeaturesRealtime ml = mlRepository.findByTimestamp(anchor).orElseGet(MLFeaturesRealtime::new);
        ml.setTimestamp(anchor);
        ml.setHour(anchor.getHour());

        ml.setQcRainMm(weather.getQcRainMm());
        ml.setMarulasRainMm(weather.getMarulasRainMm());
        ml.setMar24hrSum(weather.getMar24hrSum());
        ml.setPressureHpa(weather.getPressureHpa());
        ml.setWindSpeed(weather.getWindSpeed());
        ml.setSoilMoisture(weather.getSoilMoisture());

        ml.setQcLag1Mm(rainfallAt(anchor, 1, true));
        ml.setQcLag2Mm(rainfallAt(anchor, 2, true));
        ml.setQc3hrSum(rainfallSum(anchor, 3, true));
        ml.setQc6hrSum(rainfallSum(anchor, 6, true));

        ml.setMarLag1Mm(rainfallAt(anchor, 1, false));
        ml.setMarLag2Mm(rainfallAt(anchor, 2, false));
        ml.setMar3hrSum(rainfallSum(anchor, 3, false));

        Double previousPressure = weatherRepository
                .findFirstByTimestampLessThanEqualOrderByTimestampDesc(anchor.minusHours(1))
                .map(WeatherMetrics::getPressureHpa)
                .orElse(weather.getPressureHpa());
        ml.setPressTrend(safe(weather.getPressureHpa()) - safe(previousPressure));

        applyWindDirection(ml, weather.getWindDirectionDeg());

        tideRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(anchor)
                .ifPresent(tide -> {
                    ml.setTideHeightM(tide.getTideHeightM());
                    ml.setTideTrend(tide.getTideTrend());
                });

        MLFeaturesRealtime saved = mlRepository.save(ml);
        System.out.println(" [ML Sync] ml_features_realtime updated from weather_metrics + tide_metrics @ " + anchor);
        return Optional.of(saved);
    }

    private Double rainfallAt(LocalDateTime anchor, int hoursAgo, boolean qc) {
        LocalDateTime target = anchor.minusHours(hoursAgo);
        return weatherRepository.findFirstByTimestampLessThanEqualOrderByTimestampDesc(target)
                .map(w -> qc ? w.getQcRainMm() : w.getMarulasRainMm())
                .orElse(0.0);
    }

    private Double rainfallSum(LocalDateTime anchor, int hours, boolean qc) {
        LocalDateTime start = anchor.minusHours(hours);
        List<WeatherMetrics> recent = weatherRepository.findByTimestampAfter(start);
        return recent.stream()
                .filter(w -> !w.getTimestamp().isAfter(anchor))
                .mapToDouble(w -> qc ? safe(w.getQcRainMm()) : safe(w.getMarulasRainMm()))
                .sum();
    }

    private static void applyWindDirection(MLFeaturesRealtime ml, Double windDirectionDeg) {
        if (windDirectionDeg == null) {
            ml.setWindSin(0.0);
            ml.setWindCos(1.0);
            return;
        }
        double rad = Math.toRadians(windDirectionDeg);
        ml.setWindSin(Math.sin(rad));
        ml.setWindCos(Math.cos(rad));
    }

    private static double safe(Double v) {
        return v == null ? 0.0 : v;
    }
}
