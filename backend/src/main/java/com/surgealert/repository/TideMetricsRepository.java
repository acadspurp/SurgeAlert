package com.surgealert.repository;

import com.surgealert.entity.TideMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TideMetricsRepository extends JpaRepository<TideMetrics, Long> {
    Optional<TideMetrics> findFirstByOrderByTimestampDesc();
}
