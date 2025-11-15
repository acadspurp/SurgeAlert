package com.surgealert.repository;

import com.surgealert.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    List<Alert> findByAlertLevelOrderByTimestampDesc(String alertLevel);
}