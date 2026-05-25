import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';
import { LIVE_DATA_POLL_MS } from '../constants/livePolling.js';
import { normalizeSensorRow, isSimulatedSensorRow } from '../utils/sensorTimeseries.js';

/** Polls GET /sensor-data/latest on a short interval (Pi ingests via MQTT on the backend). */
export function useLatestSensorPolling(intervalMs = LIVE_DATA_POLL_MS) {
    const [latestSensor, setLatestSensor] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/sensor-data/latest`);
                if (response.status === 404) {
                    if (isMounted) setLatestSensor(null);
                    return;
                }
                if (response.status === 204) {
                    setLatestSensor(null);
                    return;
                }
                if (!response.ok) throw new Error('Failed to fetch latest sensor data');
                const payload = await response.json();
                const row = normalizeSensorRow(payload);
                if (isMounted) {
                    setLatestSensor(row && !isSimulatedSensorRow(row) ? row : null);
                }
            } catch (error) {
                console.error('Latest sensor poll error:', error);
            }
        };

        fetchData();
        const intervalId = setInterval(fetchData, intervalMs);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [intervalMs]);

    return latestSensor;
}
