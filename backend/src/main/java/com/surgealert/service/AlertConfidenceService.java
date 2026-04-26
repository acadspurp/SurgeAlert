package com.surgealert.service;

import com.surgealert.dto.SensorDataDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlertConfidenceService {
    private final Map<String, Deque<Double>> levelHistoryBySensor = new ConcurrentHashMap<>();

    @Value("${surgealert.confidence.reference-height-m:20.0}")
    private double referenceHeightM;

    @Value("${surgealert.confidence.smoothing-window:5}")
    private int smoothingWindow;

    @Value("${surgealert.confidence.max-delta-m-per-cycle:0.75}")
    private double maxDeltaMPerCycle;

    @Value("${surgealert.confidence.cv-min-flow-mps:0.05}")
    private double cvMinFlowMps;

    @Value("${surgealert.confidence.cv-min-rise-mps:0.005}")
    private double cvMinRiseMps;

    public ConfidenceResult evaluate(String sensorId, SensorDataDTO dto, String currentAlertLevel, String predictedAlertLevel) {
        String key = (sensorId == null || sensorId.isBlank()) ? "default-sensor" : sensorId.trim().toLowerCase();
        Deque<Double> history = levelHistoryBySensor.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        appendLevel(history, dto.getWaterLevelM());

        boolean gate1 = sensorQualityGate(history, dto.getWaterLevelM());
        boolean gate2 = cvValidationGate(dto);
        boolean gate3 = crossModalConsistencyGate(dto);
        boolean gate4 = trendAndPredictionGate(history, currentAlertLevel, predictedAlertLevel);

        List<String> reasons = new ArrayList<>();
        if (!gate1) reasons.add("sensor-quality-failed");
        if (!gate2) reasons.add("cv-validation-failed");
        if (!gate3) reasons.add("cross-modal-consistency-failed");
        if (!gate4) reasons.add("trend-prediction-failed");

        return new ConfidenceResult(gate1 && gate2 && gate3 && gate4, gate1, gate2, gate3, gate4, reasons);
    }

    private void appendLevel(Deque<Double> history, Double level) {
        if (level == null) return;
        history.addLast(level);
        int limit = Math.max(3, smoothingWindow);
        while (history.size() > limit) {
            history.removeFirst();
        }
    }

    private boolean sensorQualityGate(Deque<Double> history, Double currentLevel) {
        if (currentLevel == null) return false;
        if (currentLevel < 0 || currentLevel > referenceHeightM + 5) return false;
        if (history.size() < Math.max(3, smoothingWindow - 1)) return false;

        Double prev = null;
        for (Double v : history) {
            if (v == null || v < 0) return false;
            if (prev != null && Math.abs(v - prev) > maxDeltaMPerCycle) {
                return false;
            }
            prev = v;
        }
        return true;
    }

    private boolean cvValidationGate(SensorDataDTO dto) {
        if (dto == null) return false;
        if (dto.getImageFlowRateMps() == null || dto.getImageRiseRateMps() == null) return false;
        return dto.getImageFlowRateMps() >= cvMinFlowMps || dto.getImageRiseRateMps() >= cvMinRiseMps;
    }

    private boolean crossModalConsistencyGate(SensorDataDTO dto) {
        if (dto == null || dto.getWaterLevelM() == null || dto.getImageRiseRateMps() == null) return false;
        boolean sensorRiskHigh = dto.getWaterLevelM() >= 8.5;
        boolean cvRiskHigh = dto.getImageRiseRateMps() >= cvMinRiseMps;
        return sensorRiskHigh == cvRiskHigh || (sensorRiskHigh && cvRiskHigh);
    }

    private boolean trendAndPredictionGate(Deque<Double> history, String currentAlertLevel, String predictedAlertLevel) {
        boolean currentRed = "RED".equalsIgnoreCase(currentAlertLevel);
        boolean predictedRed = "RED".equalsIgnoreCase(predictedAlertLevel);
        if (!currentRed || !predictedRed) return false;
        if (history.size() < 2) return false;
        Double first = history.peekFirst();
        Double last = history.peekLast();
        return first != null && last != null && (last >= first);
    }

    public record ConfidenceResult(
            boolean highConfidence,
            boolean gateSensorQuality,
            boolean gateCvValidation,
            boolean gateCrossModalConsistency,
            boolean gateTrendAndPrediction,
            List<String> failedGates
    ) {}
}
