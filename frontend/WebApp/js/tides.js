import { API_BASE_URL } from './config.js';

export async function fetchTides() {
    const url = `${API_BASE_URL}/external/tides`;
    const container = document.getElementById('tide-data-container');
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Backend API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            container.innerHTML = `<p class="text-red-500 text-sm">Could not load tide data: ${data.error}</p>`;
        } else {
            updateTideUI(data.extremes);
        }
    } catch (error) {
        console.error('Failed to fetch tide data:', error);
        if (container) container.innerHTML = '<p class="text-red-500 text-sm">Could not load tide data.</p>';
    }
}

function updateTideUI(tides) {
    const container = document.getElementById('tide-data-container');
    if(!container) return;

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const highTideIcon = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>';
    const lowTideIcon = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';

    let html = `<p class="text-sm text-gray-500 mb-2">Data for: <strong>${today}</strong></p>`;
    html += '<ul class="space-y-2 text-sm">';

    if (!tides || tides.length === 0) {
        html += '<li class="text-gray-500">No tide data available for today.</li>';
    } else {
        tides.forEach(tide => {
            const tideTime = new Date(tide.dt * 1000);
            const timeString = tideTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            
            const isHigh = tide.type === 'High';
            const tideType = isHigh ? 'High Tide' : 'Low Tide';
            const icon = isHigh ? highTideIcon : lowTideIcon;
            const color = isHigh ? 'text-blue-700' : 'text-blue-500';

            html += `
                <li class="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <span class="font-semibold ${color} flex items-center">
                        ${icon} ${tideType}
                    </span>
                    <strong>${timeString}</strong>
                </li>
            `;
        });
    }
    html += '</ul>';
    container.innerHTML = html;
}