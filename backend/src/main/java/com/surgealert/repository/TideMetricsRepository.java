package com.surgealert.repository;

import com.surgealert.entity.TideMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TideMetricsRepository extends JpaRepository<TideMetrics, Long> {
    Optional<TideMetrics> findFirstByOrderByTimestampDesc();

    Optional<TideMetrics> findFirstByTimestampLessThanEqualOrderByTimestampDesc(LocalDateTime timestamp);

    boolean existsByTimestamp(LocalDateTime timestamp);

    List<TideMetrics> findByTimestampAfter(LocalDateTime timestamp);
}
