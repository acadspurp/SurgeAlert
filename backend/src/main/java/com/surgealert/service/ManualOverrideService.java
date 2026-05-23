package com.surgealert.service;

import com.surgealert.entity.SystemConfig;
import com.surgealert.repository.SystemConfigRepository;
import com.surgealert.util.AlertLevelUtils;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Optional;

@Service
public class ManualOverrideService {
    private static final String KEY_LEVEL = "alerts.override.level";

    private final SystemConfigRepository configRepository;

    public ManualOverrideService(SystemConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    @PostConstruct
    void migrateLegacyCriticalOverride() {
        configRepository.findById(KEY_LEVEL).ifPresent(cfg -> {
            if ("CRITICAL".equalsIgnoreCase(cfg.getValue().trim())) {
                configRepository.save(new SystemConfig(KEY_LEVEL, "RED"));
            }
        });
    }

    public Optional<String> getOverrideLevel() {
        return configRepository.findById(KEY_LEVEL)
                .map(SystemConfig::getValue)
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .map(AlertLevelUtils::normalize)
                .filter(AlertLevelUtils::isOverrideLevel);
    }

    public void setOverrideLevel(String level) {
        if (level == null || level.isBlank()) {
            clearOverride();
            return;
        }
        String normalized = AlertLevelUtils.normalizeOverrideLevel(level);
        if (normalized == null) {
            return;
        }
        configRepository.save(new SystemConfig(KEY_LEVEL, normalized));
    }

    public void clearOverride() {
        configRepository.deleteById(KEY_LEVEL);
    }
}
