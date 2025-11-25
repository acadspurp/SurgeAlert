import { API_BASE_URL } from './config.js';

// --- WEATHER API ---
export async function fetchWeather() {
    const weatherContainer = document.getElementById('weather-forecast');
    
    // COMPLETE WMO Weather Code Mapping
    const getWeatherInfo = (code) => {
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
        return weatherMap[code] || { description: 'Unknown', icon: '❓' };
    };

    try {
        const response = await fetch(`${API_BASE_URL}/external/weather`);
        if (!response.ok) throw new Error('Backend API Error');

        const data = await response.json();
        const dayData = data.daily;

        if (weatherContainer) weatherContainer.innerHTML = '';

        for (let i = 0; i < 5; i++) {
             if(!dayData.time[i]) continue;
             
             const dateObj = new Date(dayData.time[i]);
             const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
             const tempMax = Math.round(dayData.temperature_2m_max[i]);
             const tempMin = Math.round(dayData.temperature_2m_min[i]);
             const weatherCode = dayData.weathercode[i];
             const info = getWeatherInfo(weatherCode);

             const card = document.createElement('div');
             card.className = 'bg-gray-50 p-3 rounded-lg flex flex-col items-center';
             card.innerHTML = `
                <p class="font-semibold">${dayName}</p>
                <div class="text-4xl my-2">${info.icon}</div>
                <p class="text-sm text-gray-600 text-center leading-tight h-8 flex items-center justify-center">${info.description}</p>
                <p class="text-sm mt-1 font-medium">${tempMax}° / ${tempMin}°</p>
             `;
             if(weatherContainer) weatherContainer.appendChild(card);
        }
    } catch (error) {
        console.error('Failed to fetch weather:', error);
        if(weatherContainer) weatherContainer.innerHTML = '<p class="text-red-500 col-span-full">Weather unavailable.</p>';
    }
}

// --- RESIDENT REGISTRATION ---
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

// --- ACTION PLANS API ---
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