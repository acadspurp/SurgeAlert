package com.surgealert.service;

import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

/**
 * Dispatches SMS only when {@code current_alert_level} changes (any direction).
 * Predicted alert can block dispatch when it is materially lower than current.
 */
@Service
public class AlertNotificationStateService {

    private static final Map<String, Integer> RANK = Map.of(
            "GREEN", 0,
            "YELLOW", 1,
            "ORANGE", 2,
            "RED", 3
    );

    private volatile String lastDispatchedLevel = null;

    public boolean shouldDispatchSms(String newLevel, String predictedAlertLevel) {
        String level = normalize(newLevel);
        if (lastDispatchedLevel != null && level.equals(lastDispatchedLevel)) {
            return false;
        }
        if (shouldBlockByPrediction(level, predictedAlertLevel)) {
            return false;
        }
        if (lastDispatchedLevel == null && "GREEN".equals(level)) {
            lastDispatchedLevel = level;
            return false;
        }
        return true;
    }

    public void markDispatched(String newLevel) {
        lastDispatchedLevel = normalize(newLevel);
    }

    private boolean shouldBlockByPrediction(String currentLevel, String predictedAlertLevel) {
        int current = rank(currentLevel);
        int predicted = rank(predictedAlertLevel);
        return predicted + 1 < current;
    }

    private static int rank(String level) {
        if (level == null) return 0;
        return RANK.getOrDefault(level.toUpperCase(Locale.ROOT), 0);
    }

    private static String normalize(String level) {
        if (level == null || level.isBlank()) return "GREEN";
        return level.toUpperCase(Locale.ROOT);
    }
}
