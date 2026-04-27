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
    Optional<SensorData> findFirstByOrderByTimestampDesc();
    
    Optional<SensorData> findFirstByWaterLevelMGreaterThanEqualOrderByTimestampDesc(Double minLevel);
    
    List<SensorData> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    
    @Query("SELECT s FROM SensorData s WHERE s.timestamp >= :since AND s.waterLevelM >= 0.30 ORDER BY s.timestamp DESC")
    List<SensorData> findRecentData(LocalDateTime since);
}