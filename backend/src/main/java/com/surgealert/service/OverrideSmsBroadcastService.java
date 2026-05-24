package com.surgealert.service;

import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * Holds a pending manual-override SMS broadcast until the Pi delivers via GSM (MQTT and/or edge sync).
 */
@Service
public class OverrideSmsBroadcastService {

    public record OverrideBroadcast(String id, String level, String message) {}

    private volatile OverrideBroadcast pending;

    public OverrideBroadcast setPending(String level, String message) {
        OverrideBroadcast broadcast = new OverrideBroadcast(
                UUID.randomUUID().toString(),
                level == null ? "" : level.trim().toUpperCase(),
                message == null ? "" : message);
        this.pending = broadcast;
        return broadcast;
    }

    public Optional<OverrideBroadcast> peekPending() {
        return Optional.ofNullable(pending);
    }

    public void clearPending(String id) {
        if (pending != null && pending.id().equals(id)) {
            pending = null;
        }
    }

    public void clearAnyPending() {
        pending = null;
    }
}
