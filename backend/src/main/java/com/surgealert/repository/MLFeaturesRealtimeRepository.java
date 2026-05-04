package com.surgealert.repository;

import com.surgealert.entity.MLFeaturesRealtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MLFeaturesRealtimeRepository extends JpaRepository<MLFeaturesRealtime, Long> {
    Optional<MLFeaturesRealtime> findFirstByOrderByTimestampDesc();
    
    List<MLFeaturesRealtime> findByTimestampAfter(LocalDateTime timestamp);
}
