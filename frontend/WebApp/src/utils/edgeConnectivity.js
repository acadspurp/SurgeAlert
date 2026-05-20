/** Pi transmits on a 5-minute grid; allow ~7 minutes before marking edge offline. */
export const EDGE_STALE_SECONDS = 420;

/**
 * Derive hardware health from last successful telemetry contact with the backend.
 * GSM cannot be probed separately from the dashboard — online when edge reaches cloud.
 */
export function computeHardwareHealth(lastContactMs, telemetry, dashData) {
    const ageSec =
        lastContactMs != null && lastContactMs > 0
            ? (Date.now() - lastContactMs) / 1000
            : null;
    const edgeConnected =
        ageSec !== null && ageSec <= EDGE_STALE_SECONDS;

    if (!edgeConnected) {
        return {
            edgeConnected: false,
            mainController: false,
            gsm: false,
            ultrasonic: false,
            radar: false,
            ageSec,
        };
    }

    const parseDashNum = (str) => {
        const n = parseFloat(String(str || '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : null;
    };

    const wl =
        telemetry?.waterLevelM ??
        parseDashNum(dashData?.waterLevel);
    const flow =
        telemetry?.sensorFlowRate ??
        parseDashNum(dashData?.flowRate);
    const ghost = wl != null && wl < 0.10;

    return {
        edgeConnected: true,
        mainController: true,
        gsm: true,
        ultrasonic: wl != null && !ghost,
        radar: flow != null,
        ageSec,
    };
}
