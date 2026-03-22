// src/config.js
//export const API_BASE_URL = "http://192.168.1.32:8080/api";
//export const API_BASE_URL = "http://192.168.254.117:8080/api";
//export const API_BASE_URL = "http://192.168.100.1:8080/api";
export const API_BASE_URL = "http://localhost:8080/api";

// --- SECURE MQTT SETTINGS (HiveMQ Cloud WSS) ---
export const MQTT_BROKER_URL = "wss://YOUR_HIVEMQ_URL.s1.eu.hivemq.cloud:8884/mqtt";
export const MQTT_USERNAME = "YOUR_HIVEMQ_USERNAME";
export const MQTT_PASSWORD = "YOUR_HIVEMQ_PASSWORD";
export const MQTT_TOPIC_SENSOR = "surgealert/sensor-data";
