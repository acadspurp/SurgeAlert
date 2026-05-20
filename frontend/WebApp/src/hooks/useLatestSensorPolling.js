import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';
import { normalizeSensorRow } from '../utils/sensorTimeseries.js';

/** Polls GET /sensor-data/latest every 10s (Pi ingests via MQTT on the backend). */
export function useLatestSensorPolling() {
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
                if (!response.ok) throw new Error('Failed to fetch latest sensor data');
                const payload = await response.json();
                const row = normalizeSensorRow(payload);
                if (isMounted) {
                    setLatestSensor(row);
                }
            } catch (error) {
                console.error('Latest sensor poll error:', error);
            }
        };

        fetchData();
        const intervalId = setInterval(fetchData, 10000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    return latestSensor;
}
