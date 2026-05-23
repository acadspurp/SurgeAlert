/** Pi transmits on a 5-minute grid; allow ~7 minutes before marking edge offline. */
export const EDGE_STALE_SECONDS = 420;

/**
 * Derive hardware health from the last real sensor_data row (Edge → MQTT → DB).
 * Do not use alert status timestamps or dashboard env strings — those are not hardware heartbeats.
 * GSM cannot be probed from the cloud; it is inferred only when Edge telemetry is fresh.
 */
export function computeHardwareHealth(lastContactMs, telemetry) {
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

    const wl = telemetry?.waterLevelM;
    const flow =
        telemetry?.sensorFlowRate ?? telemetry?.fusedFlowRate ?? telemetry?.imageFlowRate;
    const ghost = wl != null && wl < 0.10;

    return {
        edgeConnected: true,
        mainController: true,
        gsm: true,
        ultrasonic: wl != null && !ghost,
        radar: flow != null && flow !== undefined && Number.isFinite(Number(flow)),
        ageSec,
    };
}
