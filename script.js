const views = ['home-view', 'maps-view', 'register-view', 'login-view'];
let map;

function showView(viewName) {
    // Add '-view' suffix if not present
    const viewId = viewName.includes('-view') ? viewName : viewName + '-view';
    
    views.forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';

    if (viewId === 'maps-view' && !map) {
        // Need a small delay to ensure the map container is visible
        setTimeout(initMap, 100);
    }
    // Close mobile menu after clicking a link
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu.style.display === 'block') {
        mobileMenu.style.display = 'none';
    }
}

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mobile-menu-button').addEventListener('click', function() {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu.style.display === 'none' || !mobileMenu.style.display) {
            mobileMenu.style.display = 'block';
        } else {
            mobileMenu.style.display = 'none';
        }
    });
    
    // Initialize the app
    showView('home');
    updateAlertStatus();
    setInterval(updateAlertStatus, 5000); // Update every 5 seconds
    fetchWeather();
});

// Water Level Alert Simulation
function updateAlertStatus() {
    const waterLevelEl = document.getElementById('water-level');
    const alertLevelEl = document.getElementById('alert-level');
    const alertDescEl = document.getElementById('alert-description');
    const containerEl = document.getElementById('alert-status-container');

    // Simulate changing water level
    let currentLevel = parseFloat(waterLevelEl.textContent);
    const change = (Math.random() - 0.45) * 0.2; // Tend to rise slightly
    let newLevel = Math.max(14.0, currentLevel + change);
    if (newLevel > 18.5) newLevel = 18.5; // Cap for simulation
    waterLevelEl.textContent = newLevel.toFixed(2) + ' m';
    
    let level, description, bgColor, textColor;

    if (newLevel < 15) {
        level = 'Normal';
        description = 'No immediate threat. River is at a safe level.';
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
    } else if (newLevel >= 15 && newLevel < 16) {
        level = 'Caution';
        description = 'First alarm. Prepare for possible evacuation.';
         bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-800';
    } else if (newLevel >= 16 && newLevel < 18) {
        level = 'Prepare';
        description = 'Second alarm. Evacuate low-lying areas.';
         bgColor = 'bg-orange-100';
        textColor = 'text-orange-800';
    } else {
        level = 'Evacuate';
        description = 'Third and final alarm. Forced evacuation in progress.';
         bgColor = 'bg-red-100';
        textColor = 'text-red-800';
    }
    
    alertLevelEl.textContent = level;
    alertDescEl.textContent = description;
    containerEl.className = `text-center p-4 rounded-lg ${bgColor} ${textColor}`;
}

// Weather Forecast
async function fetchWeather() {
    const weatherContainer = document.getElementById('weather-forecast');
    // Using Marulas, Valenzuela City coordinates
    const url = `https://api.open-meteo.com/v1/forecast?latitude=14.6773&longitude=120.9842&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Singapore`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        weatherContainer.innerHTML = ''; // Clear loading message

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 5; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const dayData = data.daily;
            const dayIndex = data.daily.time.findIndex(t => new Date(t).toDateString() === date.toDateString());
            
            if (dayIndex === -1) continue;

            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
            const tempMax = Math.round(dayData.temperature_2m_max[dayIndex]);
            const tempMin = Math.round(dayData.temperature_2m_min[dayIndex]);
            const weatherCode = dayData.weathercode[dayIndex];
            
            const weatherInfo = getWeatherInfo(weatherCode);

            const card = document.createElement('div');
            card.className = 'bg-gray-50 p-3 rounded-lg flex flex-col items-center';
            card.innerHTML = `
                <p class="font-semibold">${day}</p>
                <div class="text-4xl my-2">${weatherInfo.icon}</div>
                <p class="text-sm">${weatherInfo.description}</p>
                <p class="text-sm mt-1 font-medium">${tempMax}° / ${tempMin}°</p>
            `;
            weatherContainer.appendChild(card);
        }
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        weatherContainer.innerHTML = '<p class="text-red-500 col-span-full">Could not load weather data.</p>';
    }
}

function getWeatherInfo(code) {
    const weatherMap = {
        0: { description: 'Clear sky', icon: '☀️' },
        1: { description: 'Mainly clear', icon: '🌤️' },
        2: { description: 'Partly cloudy', icon: '⛅' },
        3: { description: 'Overcast', icon: '☁️' },
        45: { description: 'Fog', icon: '🌫️' },
        48: { description: 'Rime fog', icon: '🌫️' },
        51: { description: 'Light drizzle', icon: '🌦️' },
        53: { description: 'Drizzle', icon: '🌦️' },
        55: { description: 'Dense drizzle', icon: '🌦️' },
        61: { description: 'Slight rain', icon: '🌧️' },
        63: { description: 'Rain', icon: '🌧️' },
        65: { description: 'Heavy rain', icon: '🌧️' },
        80: { description: 'Slight showers', icon: '🌦️' },
        81: { description: 'Showers', icon: '🌦️' },
        82: { description: 'Violent showers', icon: '🌦️' },
        95: { description: 'Thunderstorm', icon: '⛈️' },
    };
    return weatherMap[code] || { description: 'Unknown', icon: '❓' };
}