import { useState, useEffect } from 'react';
//import mqtt from 'mqtt/dist/mqtt.js';
import mqtt from 'mqtt';
import { MQTT_BROKER_URL, MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC_SENSOR } from '../config.js';

export function useSensorMqtt() {
    const [mqttData, setMqttData] = useState(null);

    useEffect(() => {
        console.log("Connecting to WSS MQTT Broker...");
        const client = mqtt.connect(MQTT_BROKER_URL, {
            username: MQTT_USERNAME,
            password: MQTT_PASSWORD,
            protocol: 'ws',
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 3000,
            connectTimeout: 30 * 1000
        });

        client.on('connect', () => {
            console.log('Connected to Secure MQTT Broker via WSS');
            client.subscribe(MQTT_TOPIC_SENSOR, (err) => {
                if (err) console.error("MQTT Subscribe error: ", err);
                else console.log("Subscribed to MQTT Topic: ", MQTT_TOPIC_SENSOR);
            });
        });

        client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                setMqttData(payload);
            } catch (e) {
                console.error('Failed to parse MQTT message', e);
            }
        });

        client.on('error', (err) => {
            console.error('MQTT Error: ', err);
            client.end();
        });

        return () => {
            if (client) client.end();
        };
    }, []);

    return mqttData;
}
