import { API_BASE_URL } from './config.js';

// --- WEATHER API ---
export async function fetchWeather() {
    const weatherContainer = document.getElementById('weather-forecast');
    // Helper for Weather Icons
    const getWeatherInfo = (code) => {
        const weatherMap = {
            0: { description: 'Sunny', icon: '☀️' },
            1: { description: 'Mainly Sunny', icon: '☀️' },
            2: { description: 'Partly Cloudy', icon: '⛅' },
            3: { description: 'Cloudy', icon: '☁️' },
            45: { description: 'Foggy', icon: '🌫️' },
            51: { description: 'Light Rain', icon: '🌦️' },
            61: { description: 'Rain', icon: '🌧️' },
            80: { description: 'Showers', icon: '☔' },
            95: { description: 'Thunderstorm', icon: '⛈️' },
        };
        return weatherMap[code] || { description: 'Unknown', icon: '❓' };
    };

    try {
        // Call your Backend Proxy
        const response = await fetch(`${API_BASE_URL}/external/weather`);
        if (!response.ok) throw new Error(`Backend API Error: ${response.statusText}`);
        
        const data = await response.json();
        const dayData = data.daily;

        if (weatherContainer) weatherContainer.innerHTML = '';

        const today = new Date();
        today.setHours(0,0,0,0);

        for (let i = 0; i < 5; i++) {
            // Skip if data is missing
            if(!dayData.time[i]) continue;

            const dateStr = dayData.time[i]; 
            const dateObj = new Date(dateStr);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            
            const tempMax = Math.round(dayData.temperature_2m_max[i]);
            const tempMin = Math.round(dayData.temperature_2m_min[i]);
            const weatherCode = dayData.weathercode[i];
            const info = getWeatherInfo(weatherCode);

            const card = document.createElement('div');
            // The CSS classes are handled in main.css/styles.css, 
            // but we add basic Tailwind classes here matching your PDF
            card.className = 'bg-gray-50 p-3 rounded-lg flex flex-col items-center';
            card.innerHTML = `
                <p class="font-semibold">${dayName}</p>
                <div class="text-4xl my-2">${info.icon}</div>
                <p class="text-sm text-gray-600">${info.description}</p>
                <p class="text-sm mt-1 font-medium">${tempMax}° / ${tempMin}°</p>
            `;
            if(weatherContainer) weatherContainer.appendChild(card);
        }

    } catch (error) {
        console.error('Failed to fetch weather:', error);
        if(weatherContainer) weatherContainer.innerHTML = '<p class="text-red-500 col-span-full">Weather data unavailable.</p>';
    }
}

// --- RESIDENT REGISTRATION API ---
export async function registerResident(userData) {
    const url = `${API_BASE_URL}/residents/register`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Registration failed');
        }
        return await response.text();
    } catch (error) {
        console.error("Registration Error:", error);
        throw error;
    }
}

// --- ACTION PLANS (ALERT GUIDE) API ---
// This was previously in config.js (in the PDF), but belongs here.
export async function fetchAlertGuide() {
    try {
        const response = await fetch(`${API_BASE_URL}/public/action-plans`);
        if (!response.ok) return null;
        
        const data = await response.json();
        
        // Transform List into an Object keyed by Alert Level (green, yellow, etc.)
        const guide = {};
        data.forEach(plan => {
            const key = plan.alertLevel.toLowerCase(); // "RED" -> "red"
            
            // Combine English and Tagalog actions
            const combinedActions = plan.actionsEn.map((actionEn, index) => ({
                en: actionEn,
                tl: plan.actionsTl && plan.actionsTl[index] ? plan.actionsTl[index] : ""
            }));

            guide[key] = {
                title: plan.titleEn,
                title_tl: plan.titleTl,
                short_en: plan.shortDescriptionEn,
                short_tl: plan.shortDescriptionTl,
                actions: combinedActions
            };
        });
        
        return guide;
    } catch (error) {
        console.error("Error fetching Action Plans:", error);
        return null;
    }
}