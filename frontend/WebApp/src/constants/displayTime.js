/** Public + admin surfaces show the same Asia/Manila wall clock for camera overlays and summaries. */
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
