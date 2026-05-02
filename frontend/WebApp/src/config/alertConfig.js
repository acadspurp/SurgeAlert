/**
 * alertConfig.js — Pure utility functions. Zero hardcoded threshold values.
 *
 * All actual numbers (sensorDepthM, thresholds) come from the backend API:
 *   GET /api/public/config/thresholds
 *
 * Usage in components:
 *   const config = await fetchSystemThresholds();   // from api.js
 *   const level  = classifyAlertLevel(waterLevelM, config.thresholds);
 *   const fill   = gaugeFillPercent(waterLevelM, config.sensorDepthM);
 *   const marks  = gaugeMarkers(config.thresholds, config.sensorDepthM);
 */

/**
 * Classifies a water level reading into an alert level key.
 *
 * @param {number} levelM      - Water level in metres
 * @param {{ yellow, orange, red }} thresholds - From API response
 * @returns {'red'|'orange'|'yellow'|'green'}
 */
export function classifyAlertLevel(levelM, thresholds) {
    if (levelM === null || levelM === undefined || isNaN(levelM)) return 'green';
    if (!thresholds) return 'green';
    if (levelM >= thresholds.red)    return 'red';
    if (levelM >= thresholds.orange) return 'orange';
    if (levelM >= thresholds.yellow) return 'yellow';
    return 'green';
}

/**
 * Returns gauge fill percentage (0–100) relative to the physical sensor depth.
 *
 * @param {number} levelM       - Water level in metres
 * @param {number} sensorDepthM - Physical depth from API response
 * @returns {number}
 */
export function gaugeFillPercent(levelM, sensorDepthM) {
    if (!levelM || isNaN(levelM) || !sensorDepthM) return 0;
    return Math.min(100, (levelM / sensorDepthM) * 100);
}

/**
 * Returns threshold marker positions as % from gauge bottom, for the visual gauge.
 *
 * @param {{ yellow, orange, red }} thresholds
 * @param {number} sensorDepthM
 * @returns {{ yellow: number, orange: number, red: number }}
 */
export function gaugeMarkers(thresholds, sensorDepthM) {
    if (!thresholds || !sensorDepthM) return { yellow: 57, orange: 74, red: 90 };
    return {
        yellow: parseFloat(((thresholds.yellow / sensorDepthM) * 100).toFixed(1)),
        orange: parseFloat(((thresholds.orange / sensorDepthM) * 100).toFixed(1)),
        red:    parseFloat(((thresholds.red    / sensorDepthM) * 100).toFixed(1)),
    };
}
