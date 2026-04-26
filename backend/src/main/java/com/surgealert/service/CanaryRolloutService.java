package com.surgealert.service;

import com.surgealert.entity.SystemConfig;
import com.surgealert.repository.SystemConfigRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class CanaryRolloutService {
    @Value("${surgealert.canary.enabled:false}")
    private boolean defaultCanaryEnabled;

    @Value("${surgealert.canary.percentage:0}")
    private int defaultCanaryPercentage;

    @Value("${surgealert.canary.sensor-allowlist:}")
    private String defaultSensorAllowlist;

    private final SystemConfigRepository configRepository;
    private final AtomicReference<CanaryPhase> currentPhase = new AtomicReference<>(CanaryPhase.HEAD_ADMIN_ONLY);
    private volatile Instant phaseUpdatedAt = Instant.now();

    public CanaryRolloutService(SystemConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    private boolean isCanaryEnabled() {
        return configRepository.findById("canary.enabled")
            .map(c -> Boolean.parseBoolean(c.getValue()))
            .orElse(defaultCanaryEnabled);
    }

    private int getCanaryPercentage() {
        return configRepository.findById("canary.percentage")
            .map(c -> Integer.parseInt(c.getValue()))
            .orElse(defaultCanaryPercentage);
    }

    private String getSensorAllowlist() {
        return configRepository.findById("canary.sensor-allowlist")
            .map(SystemConfig::getValue)
            .orElse(defaultSensorAllowlist);
    }

    public CanaryState updateConfig(boolean enabled, int percentage, String allowlist) {
        configRepository.save(new SystemConfig("canary.enabled", String.valueOf(enabled)));
        configRepository.save(new SystemConfig("canary.percentage", String.valueOf(percentage)));
        configRepository.save(new SystemConfig("canary.sensor-allowlist", allowlist != null ? allowlist : ""));
        return getState();
    }

    public boolean isCanaryTraffic(String sensorId, String userRole) {
        if (!isCanaryEnabled()) {
            return false;
        }
        return switch (currentPhase.get()) {
            case HEAD_ADMIN_ONLY -> "HEAD_ADMIN".equalsIgnoreCase(normalizeRole(userRole));
            case ADMIN_ONLY -> {
                String role = normalizeRole(userRole);
                yield "HEAD_ADMIN".equals(role) || "ADMIN".equals(role);
            }
            case SENSOR_CANARY -> isSensorCanary(sensorId);
            case EVERYONE -> true;
        };
    }

    public CanaryState getState() {
        return new CanaryState(
            currentPhase.get().name(), 
            phaseUpdatedAt.toString(), 
            isCanaryEnabled(), 
            getCanaryPercentage(),
            getSensorAllowlist()
        );
    }

    public CanaryState advancePhase() {
        currentPhase.updateAndGet(phase -> switch (phase) {
            case HEAD_ADMIN_ONLY -> CanaryPhase.ADMIN_ONLY;
            case ADMIN_ONLY -> CanaryPhase.SENSOR_CANARY;
            case SENSOR_CANARY -> CanaryPhase.EVERYONE;
            case EVERYONE -> CanaryPhase.EVERYONE;
        });
        phaseUpdatedAt = Instant.now();
        return getState();
    }

    public CanaryState rollbackPhase() {
        currentPhase.updateAndGet(phase -> switch (phase) {
            case EVERYONE -> CanaryPhase.SENSOR_CANARY;
            case SENSOR_CANARY -> CanaryPhase.ADMIN_ONLY;
            case ADMIN_ONLY -> CanaryPhase.HEAD_ADMIN_ONLY;
            case HEAD_ADMIN_ONLY -> CanaryPhase.HEAD_ADMIN_ONLY;
        });
        phaseUpdatedAt = Instant.now();
        return getState();
    }

    private boolean isSensorCanary(String sensorId) {
        if (sensorId == null || sensorId.isBlank()) return false;
        Set<String> allowlist = new HashSet<>();
        String currentAllowlist = getSensorAllowlist();
        if (currentAllowlist != null && !currentAllowlist.isBlank()) {
            allowlist.addAll(Arrays.stream(currentAllowlist.split(","))
                    .map(String::trim)
                    .filter(v -> !v.isEmpty())
                    .map(String::toLowerCase)
                    .toList());
        }
        if (allowlist.contains(sensorId.trim().toLowerCase())) {
            return true;
        }
        int percentage = getCanaryPercentage();
        int bounded = Math.max(0, Math.min(100, percentage));
        int bucket = Math.abs(sensorId.trim().toLowerCase().hashCode()) % 100;
        return bucket < bounded;
    }

    private static String normalizeRole(String userRole) {
        if (userRole == null) return "";
        String role = userRole.trim().toUpperCase();
        return role.startsWith("ROLE_") ? role.substring(5) : role;
    }

    private enum CanaryPhase {
        HEAD_ADMIN_ONLY,
        ADMIN_ONLY,
        SENSOR_CANARY,
        EVERYONE
    }

    public record CanaryState(String phase, String phaseUpdatedAt, boolean enabled, int sensorCanaryPercentage, String sensorAllowlist) {
    }
}
