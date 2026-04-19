// src/config.js
//export const API_BASE_URL = "http://192.168.1.32:8080/api";
//export const API_BASE_URL = "http://192.168.254.117:8080/api";
//export const API_BASE_URL = "http://192.168.100.1:8080/api";
export const API_BASE_URL = "http://localhost:8080/api";

// --- SECURE MQTT SETTINGS REMOVED ---
// WebApp now uses HTTP polling via the Java backend to access sensor data safely
// without exposing direct message broker credentials to the public web client.
