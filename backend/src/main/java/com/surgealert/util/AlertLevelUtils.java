package com.surgealert.util;

import java.util.Locale;
import java.util.Set;

/** Canonical alert colors: GREEN, YELLOW, ORANGE, RED only. */
public final class AlertLevelUtils {

    public static final Set<String> LEVELS = Set.of("GREEN", "YELLOW", "ORANGE", "RED");

    private AlertLevelUtils() {}

    /**
     * Normalizes a stored or incoming level. Legacy {@code CRITICAL} is treated as {@code RED}.
     */
    public static String normalize(String level) {
        if (level == null || level.isBlank()) {
            return "GREEN";
        }
        String upper = level.trim().toUpperCase(Locale.ROOT);
        if ("CRITICAL".equals(upper)) {
            return "RED";
        }
        if (LEVELS.contains(upper)) {
            return upper;
        }
        return "GREEN";
    }

    /** Head-admin manual override broadcast levels (not GREEN). */
    public static String normalizeOverrideLevel(String level) {
        if (level == null || level.isBlank()) {
            return null;
        }
        String upper = level.trim().toUpperCase(Locale.ROOT);
        if ("AUTO".equals(upper) || "NORMAL".equals(upper) || "GREEN".equals(upper)) {
            return null;
        }
        if ("CRITICAL".equals(upper)) {
            return null;
        }
        if ("YELLOW".equals(upper) || "ORANGE".equals(upper) || "RED".equals(upper)) {
            return upper;
        }
        return null;
    }

    public static boolean isOverrideLevel(String level) {
        return "YELLOW".equals(level) || "ORANGE".equals(level) || "RED".equals(level);
    }
}
