package com.surgealert.config;

import com.surgealert.repository.MLFeaturesRealtimeRepository;
import com.surgealert.repository.SensorDataRepository;
import com.surgealert.repository.TideMetricsRepository;
import com.surgealert.repository.WeatherMetricsRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Logs which core tables exist after startup. {@code sensor_data} is created empty;
 * rows are inserted later by Edge/MQTT hardware ingest.
 */
@Component
@Order(100)
public class DatabaseSchemaHealthRunner implements ApplicationRunner {

    private static final String[] CORE_TABLES = {
            "sensor_data",
            "weather_metrics",
            "tide_metrics",
            "ml_features_realtime"
    };

    private final JdbcTemplate jdbcTemplate;
    private final SensorDataRepository sensorDataRepository;
    private final WeatherMetricsRepository weatherMetricsRepository;
    private final TideMetricsRepository tideMetricsRepository;
    private final MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository;

    public DatabaseSchemaHealthRunner(
            JdbcTemplate jdbcTemplate,
            SensorDataRepository sensorDataRepository,
            WeatherMetricsRepository weatherMetricsRepository,
            TideMetricsRepository tideMetricsRepository,
            MLFeaturesRealtimeRepository mlFeaturesRealtimeRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.sensorDataRepository = sensorDataRepository;
        this.weatherMetricsRepository = weatherMetricsRepository;
        this.tideMetricsRepository = tideMetricsRepository;
        this.mlFeaturesRealtimeRepository = mlFeaturesRealtimeRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        System.out.println("[Schema] Core table check (sensor_data may be empty until Edge hardware posts data):");
        for (String table : CORE_TABLES) {
            logTableStatus(table);
        }
        try {
            System.out.println("[Schema] Row counts — sensor_data=" + sensorDataRepository.count()
                    + ", weather_metrics=" + weatherMetricsRepository.count()
                    + ", tide_metrics=" + tideMetricsRepository.count()
                    + ", ml_features_realtime=" + mlFeaturesRealtimeRepository.count());
        } catch (Exception e) {
            System.err.println("[Schema] Could not count rows: " + e.getMessage());
        }
    }

    private void logTableStatus(String table) {
        try {
            String regclass = jdbcTemplate.queryForObject(
                    "SELECT to_regclass('public.' || ?)::text",
                    String.class,
                    table);
            if (regclass == null) {
                System.err.println("[Schema] MISSING: " + table + " — redeploy backend or run db/required-tables.sql");
            } else {
                System.out.println("[Schema] present: " + table);
            }
        } catch (Exception e) {
            System.err.println("[Schema] check failed for " + table + ": " + e.getMessage());
        }
    }
}
