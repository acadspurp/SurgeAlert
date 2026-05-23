/** Timezone helpers for tides, logs, charts, live UI clock, etc. */
export const DISPLAY_TIMEZONE = 'Asia/Manila';
export const TIDE_DISPLAY_TIMEZONE = 'Asia/Manila';

const clockLocaleOpts = { hour12: true, timeZone: DISPLAY_TIMEZONE };

export function formatManilaWallClockFromMs(ms = Date.now(), { withSeconds = true } = {}) {
    return new Date(ms).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        ...(withSeconds ? { second: '2-digit' } : {}),
        ...clockLocaleOpts,
    });
}

export function formatManilaWallDateFromMs(ms = Date.now()) {
    return new Date(ms).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: DISPLAY_TIMEZONE,
    });
}

/** Relative + absolute labels for a sensor_data row timestamp (ms since epoch). */
export function formatSensorAge(lastMs) {
    if (lastMs == null || !Number.isFinite(lastMs)) {
        return {
            secondsAgo: null,
            relative: null,
            absoluteClock: null,
            absoluteDate: null,
            shortLabel: '—',
        };
    }
    const secondsAgo = Math.max(0, Math.floor((Date.now() - lastMs) / 1000));
    const absoluteClock = formatManilaWallClockFromMs(lastMs);
    const absoluteDate = formatManilaWallDateFromMs(lastMs);
    return {
        secondsAgo,
        relative: `${secondsAgo}s ago`,
        absoluteClock,
        absoluteDate,
        shortLabel: `${secondsAgo}s ago · ${absoluteClock} · ${absoluteDate} (Manila)`,
    };
}
