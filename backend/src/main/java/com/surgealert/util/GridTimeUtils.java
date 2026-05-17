package com.surgealert.util;

import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Aligns timestamps to the Pi 5-minute grid (:00, :05, :10, …) — matches EdgeSystem edge_time_utils.
 */
public final class GridTimeUtils {

    public static final ZoneId MANILA = ZoneId.of("Asia/Manila");

    private GridTimeUtils() {}

    public static LocalDateTime alignToFiveMinuteGrid(LocalDateTime dt) {
        if (dt == null) {
            dt = LocalDateTime.now(MANILA);
        }
        int alignedMinute = (dt.getMinute() / 5) * 5;
        return dt.withMinute(alignedMinute).withSecond(0).withNano(0);
    }

    public static LocalDateTime parseAndAlignGridTimestamp(String timestampIso) {
        String normalized = timestampIso.contains("T") ? timestampIso : timestampIso.replace(" ", "T");
        String slice = normalized.length() > 19 ? normalized.substring(0, 19) : normalized;
        return alignToFiveMinuteGrid(LocalDateTime.parse(slice));
    }
}
