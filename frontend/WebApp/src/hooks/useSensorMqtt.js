import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';
import { normalizeSensorRow } from '../utils/sensorTimeseries.js';

export function useSensorMqtt() {
    const [mqttData, setMqttData] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                // Poll backend instead of MQTT streaming to optimize resources
                const response = await fetch(`${API_BASE_URL}/sensor-data/latest`);
                if (response.status === 404) {
                    if (isMounted) setMqttData(null);
                    return;
                }
                if (!response.ok) throw new Error('Failed to fetch latest sensor data');
                const payload = await response.json();
                const row = normalizeSensorRow(payload);
                if (isMounted) {
                    setMqttData(row);
                }
            } catch (error) {
                console.error("Polling error:", error);
            }
        };

        // Fetch immediately
        fetchData();

        // Poll every 10 seconds (10,000 ms) to ensure real-time health checks
        const intervalId = setInterval(fetchData, 10000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    return mqttData;
}
