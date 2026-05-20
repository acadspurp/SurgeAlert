package com.surgealert.service;

import com.surgealert.entity.SystemConfig;
import com.surgealert.repository.SystemConfigRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ManualOverrideService {
    private static final String KEY_LEVEL = "alerts.override.level";

    private final SystemConfigRepository configRepository;

    public ManualOverrideService(SystemConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    public Optional<String> getOverrideLevel() {
        return configRepository.findById(KEY_LEVEL)
                .map(SystemConfig::getValue)
                .map(String::trim)
                .filter(v -> !v.isEmpty());
    }

    public void setOverrideLevel(String level) {
        if (level == null || level.isBlank()) {
            clearOverride();
            return;
        }
        configRepository.save(new SystemConfig(KEY_LEVEL, level.trim().toUpperCase()));
    }

    public void clearOverride() {
        configRepository.deleteById(KEY_LEVEL);
    }
}
