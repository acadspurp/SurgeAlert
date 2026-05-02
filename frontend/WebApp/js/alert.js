import { API_BASE_URL } from './config.js';
import { fetchAlertGuide } from './api.js'; // CHANGED: Now importing from api.js

// Variable to store the guide so we don't fetch it every single time
let CACHED_GUIDE = null;

export async function updateAlertStatus() {
    const waterLevelEl = document.getElementById('water-level');
    const alertLevelEl = document.getElementById('alert-level');
    const alertDescEl = document.getElementById('alert-description');
    const actionsCard = document.getElementById('actions-card');
    const leftCard = document.getElementById('left-alert-card');
    const h2 = actionsCard ? actionsCard.querySelector('h2') : null;

    if(!waterLevelEl || !alertLevelEl) return;

    try {
        // 1. LOAD THE GUIDE (If we haven't already)
        if (!CACHED_GUIDE) {
            CACHED_GUIDE = await fetchAlertGuide();
            if (!CACHED_GUIDE) {
                console.warn("Alert Guide could not be loaded. Using defaults or empty.");
            }
        }

        // 2. Fetch Sensor Data from Backend
        const response = await fetch(`${API_BASE_URL}/public/alerts/status`);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        // --- HANDLE OFFLINE STATE ---
        if (data.waterLevelM === null || data.alertLevel === 'OFFLINE') {
            waterLevelEl.textContent = "--.-- m";
            alertLevelEl.textContent = "SENSOR OFFLINE";
            alertLevelEl.className = "text-lg mt-2 font-semibold text-gray-500";
            
            if(leftCard) resetClasses(leftCard, actionsCard, h2);
            if(leftCard) leftCard.classList.add('bg-gray-200');
            
            if(actionsCard) actionsCard.classList.add('border-gray-400');
            if(h2) h2.classList.add('text-gray-600');

            if(alertDescEl) {
                alertDescEl.innerHTML = `
                    <div class="p-4 bg-gray-100 rounded text-gray-600">
                        <strong>System Status: Offline</strong><br/>
                        Waiting for connection to monitoring sensors.
                    </div>`;
            }
            return;
        }

        // --- HANDLE ONLINE STATE ---
        const currentLevel = data.waterLevelM;
        const levelKey = data.alertLevel.toLowerCase(); // 'green', 'yellow', etc.

        // Update Text
        waterLevelEl.textContent = currentLevel.toFixed(2) + ' m';
        
        const timeString = new Date(data.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        // You need to create a <p id="last-updated"> in your HTML first for this to work
        if(document.getElementById('last-updated')) {
            document.getElementById('last-updated').textContent = `As of ${timeString}`;
        }
        // USE THE CACHED GUIDE HERE
        if (CACHED_GUIDE && (CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'])) {
            const guide = CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'];
            
            alertLevelEl.textContent = guide.title;

            // Update Actions Description
            let html = '';
            html += `<div class="mb-2"><strong>${guide.title}</strong><br/><em>${guide.title_tl}</em></div>`;
            html += `<p class="mb-2 text-gray-700">${guide.short_en}</p>`;
            html += `<p class="mb-4 text-gray-700"><em>${guide.short_tl}</em></p>`;
            
            html += `<h4 class="font-semibold mb-2">Actions / Gabay</h4>`;
            html += `<ol class="list-decimal list-inside space-y-2 text-sm">`;
            
            if(guide.actions) {
                guide.actions.forEach(act => {
                    html += `<li><strong>${act.en}</strong><div class="text-gray-700 ml-4">${act.tl}</div></li>`;
                });
            }
            html += `</ol>`;
            
            if(alertDescEl) alertDescEl.innerHTML = html;
        } else {
            // Fallback if Guide failed to load
            alertLevelEl.textContent = `LEVEL: ${data.alertLevel}`;
        }

        // Update Colors
        updateColors(levelKey, leftCard, actionsCard, h2);

    } catch (error) {
        console.error("Failed to fetch alert status:", error);
        waterLevelEl.textContent = "--.-- m";
        alertLevelEl.textContent = "CONNECTION ERROR";
        if(leftCard) leftCard.classList.add('bg-gray-200');
    }
}

// --- HELPER FUNCTIONS ---
function resetClasses(leftCard, actionsCard, h2) {
    if(!leftCard || !actionsCard || !h2) return;

    const bgClasses = ['bg-green-100', 'bg-yellow-100', 'bg-orange-100', 'bg-red-100', 'bg-gray-200'];
    const borderClasses = ['border-green-500', 'border-yellow-400', 'border-orange-500', 'border-red-600', 'border-gray-400'];
    const textClasses = ['text-green-800', 'text-yellow-800', 'text-orange-800', 'text-red-800', 'text-gray-600'];

    leftCard.classList.remove(...bgClasses);
    actionsCard.classList.remove(...borderClasses);
    h2.classList.remove(...textClasses);
}

function updateColors(levelKey, leftCard, actionsCard, h2) {
    resetClasses(leftCard, actionsCard, h2);

    if(!leftCard) return;

    if (levelKey === 'green') {
        leftCard.classList.add('bg-green-100');
        actionsCard.classList.add('border-green-500');
        h2.classList.add('text-green-800');
    } else if (levelKey === 'yellow') {
        leftCard.classList.add('bg-yellow-100');
        actionsCard.classList.add('border-yellow-400');
        h2.classList.add('text-yellow-800');
    } else if (levelKey === 'orange') {
        leftCard.classList.add('bg-orange-100');
        actionsCard.classList.add('border-orange-500');
        h2.classList.add('text-orange-800');
    } else if (levelKey === 'red') {
        leftCard.classList.add('bg-red-100');
        actionsCard.classList.add('border-red-600');
        h2.classList.add('text-red-800');
    }
}