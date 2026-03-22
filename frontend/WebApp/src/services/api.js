import { API_BASE_URL } from '../config.js';

// --- WEATHER API ---
const weatherMap = {
    0: { description: 'Clear Sky', icon: '☀️' },
    1: { description: 'Mainly Sunny', icon: '🌤️' },
    2: { description: 'Partly Cloudy', icon: '⛅' },
    3: { description: 'Overcast', icon: '☁️' },
    45: { description: 'Fog', icon: '🌫️' },
    48: { description: 'Depositing Rime Fog', icon: '🌫️' },
    51: { description: 'Light Drizzle', icon: '🌦️' },
    53: { description: 'Moderate Drizzle', icon: '🌦️' },
    55: { description: 'Dense Drizzle', icon: '🌧️' },
    56: { description: 'Light Freezing Drizzle', icon: '🌨️' },
    57: { description: 'Dense Freezing Drizzle', icon: '🌨️' },
    61: { description: 'Slight Rain', icon: '🌧️' },
    63: { description: 'Moderate Rain', icon: '🌧️' },
    65: { description: 'Heavy Rain', icon: '⛈️' },
    66: { description: 'Light Freezing Rain', icon: '🌨️' },
    67: { description: 'Heavy Freezing Rain', icon: '🌨️' },
    71: { description: 'Slight Snow', icon: '❄️' },
    73: { description: 'Moderate Snow', icon: '❄️' },
    75: { description: 'Heavy Snow', icon: '❄️' },
    77: { description: 'Snow Grains', icon: '❄️' },
    80: { description: 'Slight Rain Showers', icon: '🌦️' },
    81: { description: 'Moderate Rain Showers', icon: '🌧️' },
    82: { description: 'Violent Rain Showers', icon: '⛈️' },
    85: { description: 'Slight Snow Showers', icon: '❄️' },
    86: { description: 'Heavy Snow Showers', icon: '❄️' },
    95: { description: 'Thunderstorm', icon: '⚡' },
    96: { description: 'Thunderstorm with Hail', icon: '⛈️' },
    99: { description: 'Heavy Thunderstorm with Hail', icon: '⛈️' },
};

export function getWeatherInfo(code) {
    return weatherMap[code] || { description: 'Clear Sky', icon: '☀️' };
}

export async function fetchWeatherData() {
    const response = await fetch(`${API_BASE_URL}/external/weather`);
    if (!response.ok) throw new Error('Backend API Error');
    return await response.json();
}

// --- ALERT STATUS ---
export async function fetchAlertStatus() {
    const response = await fetch(`${API_BASE_URL}/public/alerts/status`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
}

// --- CAMERA FEED ---
export async function fetchCameraFeed() {
    const response = await fetch(`${API_BASE_URL}/public/alerts/camera`);
    return await response.json();
}

// --- ACTION PLANS / ALERT GUIDE ---
export async function fetchAlertGuide() {
    try {
        const response = await fetch(`${API_BASE_URL}/public/action-plans`);
        if (!response.ok) return null;

        const dataList = await response.json();

        const guide = {};
        dataList.forEach(plan => {
            const key = plan.alertLevel.toLowerCase();
            guide[key] = {
                title: plan.titleEn,
                title_tl: plan.titleTl,
                short_en: plan.shortDescriptionEn,
                short_tl: plan.shortDescriptionTl,
                actions: plan.actionsEn.map((en, i) => ({
                    en: en,
                    tl: plan.actionsTl && plan.actionsTl[i] ? plan.actionsTl[i] : ""
                }))
            };
        });

        return guide;
    } catch (error) {
        console.error("Error fetching Action Plans:", error);
        return null;
    }
}

// --- TIDES ---
export async function fetchTidesData() {
    const response = await fetch(`${API_BASE_URL}/external/tides`);
    if (!response.ok) throw new Error(`Backend API Error: ${response.statusText}`);
    return await response.json();
}

// --- EVACUATION SITES ---
export async function fetchEvacuationSites() {
    const response = await fetch(`${API_BASE_URL}/public/evacuation-sites`);
    if (!response.ok) throw new Error('Failed to fetch map data');
    return await response.json();
}

// --- RESIDENT REGISTRATION ---
export async function registerResident(userData) {
    const response = await fetch(`${API_BASE_URL}/residents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Registration failed');
    }
    return await response.text();
}

// --- OTP ---
export async function sendOtp(phoneNumber) {
    const response = await fetch(`${API_BASE_URL}/residents/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error sending OTP');
    }
    return await response.json();
}

export async function verifyOtp(phoneNumber, code) {
    const response = await fetch(`${API_BASE_URL}/residents/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code })
    });

    if (!response.ok) throw new Error("Invalid OTP");
    return true;
}

// --- AUTH ---
export async function loginUser(username, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Invalid username or password');
    }

    return await response.json();
}

// --- ADMIN: RESIDENTS ---
export async function fetchActiveResidents() {
    const response = await fetch(`${API_BASE_URL}/residents/active`);
    if (!response.ok) throw new Error('Failed to fetch residents');
    return await response.json();
}

export async function deleteResident(id) {
    const response = await fetch(`${API_BASE_URL}/residents/id/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');
}

// --- ADMIN: TEMPLATES ---
export async function fetchTemplates() {
    const response = await fetch(`${API_BASE_URL}/admin/templates`);
    return await response.json();
}

export async function saveTemplate(type, template) {
    const response = await fetch(`${API_BASE_URL}/admin/templates/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
    });
    if (!response.ok) throw new Error('Failed to update template');
    return true;
}

// --- ADMIN: SENSOR DATA (for chart) ---
export async function fetchSensorData(hours = 24) {
    const response = await fetch(`${API_BASE_URL}/sensor-data/recent?hours=${hours}`);
    if (!response.ok) throw new Error('Failed to fetch sensor data');
    return await response.json();
}
