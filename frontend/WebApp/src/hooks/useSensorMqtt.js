import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config.js';

export function useSensorMqtt() {
    const [mqttData, setMqttData] = useState(null);

    useEffect(() => {
        let isMounted = true;
        
        const fetchLatest = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/sensor-data/latest`);
                if (response.ok) {
                    const data = await response.json();
                    if (isMounted) setMqttData(data);
                }
            } catch (err) {
                console.error('Failed to fetch latest sensor data', err);
            }
        };

        fetchLatest();
        const intervalId = setInterval(fetchLatest, 3000); // Poll every 3 seconds

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    return mqttData;
}
