package com.surgealert.repository;

import com.surgealert.entity.ActionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ActionPlanRepository extends JpaRepository<ActionPlan, Long> {
    Optional<ActionPlan> findByAlertLevel(String alertLevel);
}