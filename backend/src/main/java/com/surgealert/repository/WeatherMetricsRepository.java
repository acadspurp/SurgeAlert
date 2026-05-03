package com.surgealert.repository;

import com.surgealert.entity.WeatherMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WeatherMetricsRepository extends JpaRepository<WeatherMetrics, Long> {
    Optional<WeatherMetrics> findFirstByOrderByTimestampDesc();
}
