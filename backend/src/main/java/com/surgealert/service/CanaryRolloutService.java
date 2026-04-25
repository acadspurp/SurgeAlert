package com.surgealert.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CanaryRolloutService {
    @Value("${surgealert.canary.enabled:false}")
    private boolean canaryEnabled;

    @Value("${surgealert.canary.percentage:0}")
    private int canaryPercentage;

    public boolean isCanaryTraffic(String sensorId) {
        if (!canaryEnabled || sensorId == null || sensorId.isBlank()) {
            return false;
        }
        int bounded = Math.max(0, Math.min(100, canaryPercentage));
        int bucket = Math.abs(sensorId.trim().toLowerCase().hashCode()) % 100;
        return bucket < bounded;
    }
}
