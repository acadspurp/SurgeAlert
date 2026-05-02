import { API_BASE_URL } from './config.js';

export async function initMap() {
    // 1. Initialize Map
    const map = L.map('map-container').setView([14.6773, 120.9842], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 2. Define Icon
    const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        shadowSize: [41, 41]
    });

    // 3. Fetch Data from Backend
    try {
        const response = await fetch(`${API_BASE_URL}/public/evacuation-sites`);
        
        if (!response.ok) throw new Error(`Failed to fetch map data: ${response.statusText}`);

        const evacuationSites = await response.json();

        evacuationSites.forEach(site => {
            if (site.latitude && site.longitude) {
                L.marker([site.latitude, site.longitude], { icon: customIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div class="text-center">
                            <strong class="text-blue-700">${site.name}</strong><br>
                            <span class="text-xs text-gray-600">${site.address}</span><br>
                            <span class="text-xs font-semibold mt-1 block">Capacity: ${site.capacity}</span>
                        </div>
                    `);
            }
        });
    } catch (error) {
        console.error("Error loading map markers:", error);
    }

    return map;
}