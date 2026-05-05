package com.surgealert.repository;

import com.surgealert.entity.SensorData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SensorDataRepository extends JpaRepository<SensorData, Long> {
    interface LatestSensorProjection {
        Long getId();
        LocalDateTime getTimestamp();
        Double getWaterLevelM();
        Double getSensorFlowRateMps();
        Double getImageFlowRateMps();
        Double getImageRiseRateMps();
        Double getSensorRiseRate();
        String getCurrentAlertLevel();
        Double getPredictedLevel();
        String getPredictedAlertLevel();
    }

    Optional<SensorData> findFirstByOrderByTimestampDesc();
    
    Optional<SensorData> findFirstByTimestampLessThanEqualOrderByTimestampDesc(LocalDateTime timestamp);
    
    Optional<SensorData> findFirstByWaterLevelMGreaterThanEqualOrderByTimestampDesc(Double minLevel);
    
    List<SensorData> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    
    @Query("SELECT s FROM SensorData s WHERE s.timestamp >= :since AND s.waterLevelM >= 0.30 ORDER BY s.timestamp DESC")
    List<SensorData> findRecentData(LocalDateTime since);

    @Query(value = """
            SELECT
              id AS id,
              time AS timestamp,
              water_level AS waterLevelM,
              sensor_flow_rate_mps AS sensorFlowRateMps,
              image_flow_rate_mps AS imageFlowRateMps,
              rise_rate AS imageRiseRateMps,
              sensor_rise_rate AS sensorRiseRate,
              current_alert_level AS currentAlertLevel,
              predicted_level AS predictedLevel,
              predicted_alert_level AS predictedAlertLevel
            FROM sensor_data
            WHERE time <= :timestamp
            ORDER BY time DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<LatestSensorProjection> findLatestProjectionBefore(LocalDateTime timestamp);
}