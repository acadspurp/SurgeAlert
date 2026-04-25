package com.surgealert.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CriticalAlertApprovalService {
    private final Map<String, PendingCriticalAlert> pendingAlerts = new ConcurrentHashMap<>();

    @Value("${surgealert.human-envelope.enabled:true}")
    private boolean humanEnvelopeEnabled;

    @Value("${surgealert.human-envelope.approval-timeout-seconds:180}")
    private long timeoutSeconds;

    public boolean requiresApproval(String alertLevel) {
        return humanEnvelopeEnabled && "RED".equalsIgnoreCase(alertLevel);
    }

    public PendingCriticalAlert createPendingAlert(String source, String message, Double waterLevel) {
        Instant now = Instant.now();
        PendingCriticalAlert alert = new PendingCriticalAlert(
                UUID.randomUUID().toString(),
                source,
                message,
                waterLevel,
                now,
                now.plusSeconds(Math.max(60, timeoutSeconds)),
                "PENDING"
        );
        pendingAlerts.put(alert.id(), alert);
        return alert;
    }

    public PendingCriticalAlert getPendingAlert(String id) {
        PendingCriticalAlert alert = pendingAlerts.get(id);
        if (alert == null) return null;
        if (Instant.now().isAfter(alert.expiresAt()) && "PENDING".equals(alert.status())) {
            PendingCriticalAlert expired = alert.withStatus("EXPIRED");
            pendingAlerts.put(id, expired);
            return expired;
        }
        return alert;
    }

    public PendingCriticalAlert approve(String id) {
        PendingCriticalAlert alert = getPendingAlert(id);
        if (alert == null || !"PENDING".equals(alert.status())) return alert;
        PendingCriticalAlert approved = alert.withStatus("APPROVED");
        pendingAlerts.put(id, approved);
        return approved;
    }

    public PendingCriticalAlert reject(String id) {
        PendingCriticalAlert alert = getPendingAlert(id);
        if (alert == null || !"PENDING".equals(alert.status())) return alert;
        PendingCriticalAlert rejected = alert.withStatus("REJECTED");
        pendingAlerts.put(id, rejected);
        return rejected;
    }

    public record PendingCriticalAlert(
            String id,
            String source,
            String message,
            Double waterLevel,
            Instant createdAt,
            Instant expiresAt,
            String status
    ) {
        public PendingCriticalAlert withStatus(String nextStatus) {
            return new PendingCriticalAlert(id, source, message, waterLevel, createdAt, expiresAt, nextStatus);
        }
    }
}
