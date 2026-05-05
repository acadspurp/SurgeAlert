/**
 * Demo UI clock: starts at 5:27 PM (Asia/Manila) on the calendar day when the session begins,
 * then advances one second per real second so it “counts” forward from there.
 */
export const UI_CLOCK_ANCHOR_HOUR = 17;
export const UI_CLOCK_ANCHOR_MINUTE = 27;

/** Timezone helpers for tides, logs, charts, etc. */
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
