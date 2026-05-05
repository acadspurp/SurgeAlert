package com.surgealert.repository;

import com.surgealert.entity.WeatherMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface WeatherMetricsRepository extends JpaRepository<WeatherMetrics, Long> {
    Optional<WeatherMetrics> findFirstByOrderByTimestampDesc();
    
    Optional<WeatherMetrics> findFirstByTimestampBeforeOrderByTimestampDesc(LocalDateTime timestamp);
    
    List<WeatherMetrics> findByTimestampAfter(LocalDateTime timestamp);
}
