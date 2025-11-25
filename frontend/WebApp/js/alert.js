import { API_BASE_URL } from './config.js';
import { fetchAlertGuide } from './api.js';

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
        // 1. Load Guide
        if (!CACHED_GUIDE) {
            CACHED_GUIDE = await fetchAlertGuide();
        }

        // 2. Fetch Status
        const response = await fetch(`${API_BASE_URL}/public/alerts/status`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json(); 

        // Handle Offline/Null
        if (data.alertLevel === 'OFFLINE' || data.waterLevelM === null) {
            waterLevelEl.textContent = "--.-- m";
            alertLevelEl.textContent = "SENSOR OFFLINE";
            alertLevelEl.className = "text-lg mt-2 font-semibold text-gray-500";
            if(leftCard) resetClasses(leftCard, actionsCard, h2);
            if(leftCard) leftCard.classList.add('bg-gray-200');
            return;
        }

        // Handle Online
        const currentLevel = data.waterLevelM;
        const levelKey = data.alertLevel.toLowerCase();

        waterLevelEl.textContent = currentLevel.toFixed(2) + ' m';
        
        // Update Guide Text
        if (CACHED_GUIDE && (CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'])) {
            const guide = CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'];
            alertLevelEl.textContent = guide.title;
            
            // Build Actions HTML
            let html = `<div class="mb-2"><strong>${guide.title}</strong><br/><em>${guide.title_tl}</em></div>`;
            html += `<p class="mb-2 text-gray-700">${guide.short_en}</p>`;
            html += `<h4 class="font-semibold mb-2 mt-4">Actions / Gabay</h4><ol class="list-decimal list-inside space-y-2 text-sm">`;
            
            if(guide.actions) {
                guide.actions.forEach(act => {
                    html += `<li><strong>${act.en}</strong><div class="text-gray-700 ml-4 mb-2"><em>${act.tl}</em></div></li>`;
                });
            }
            html += `</ol>`;
            
            if(alertDescEl) alertDescEl.innerHTML = html;
        } else {
            alertLevelEl.textContent = `LEVEL: ${data.alertLevel}`;
        }

        updateColors(levelKey, leftCard, actionsCard, h2);

    } catch (error) {
        console.error("Failed to fetch status:", error);
    }
}

function resetClasses(leftCard, actionsCard, h2) {
    if(!leftCard) return;
    const bgClasses = ['bg-green-100', 'bg-yellow-100', 'bg-orange-100', 'bg-red-100', 'bg-gray-200'];
    const borderClasses = ['border-green-500', 'border-yellow-400', 'border-orange-500', 'border-red-600', 'border-gray-400'];
    const textClasses = ['text-green-800', 'text-yellow-800', 'text-orange-800', 'text-red-800', 'text-gray-600'];
    
    leftCard.classList.remove(...bgClasses);
    if(actionsCard) actionsCard.classList.remove(...borderClasses);
    if(h2) h2.classList.remove(...textClasses);
}

function updateColors(levelKey, leftCard, actionsCard, h2) {
    resetClasses(leftCard, actionsCard, h2);
    if(!leftCard) return;

    if (levelKey === 'green') {
        leftCard.classList.add('bg-green-100');
        if(actionsCard) actionsCard.classList.add('border-green-500');
        if(h2) h2.classList.add('text-green-800');
    } else if (levelKey === 'yellow') {
        leftCard.classList.add('bg-yellow-100');
        if(actionsCard) actionsCard.classList.add('border-yellow-400');
        if(h2) h2.classList.add('text-yellow-800');
    } else if (levelKey === 'orange') {
        leftCard.classList.add('bg-orange-100');
        if(actionsCard) actionsCard.classList.add('border-orange-500');
        if(h2) h2.classList.add('text-orange-800');
    } else if (levelKey === 'red') {
        leftCard.classList.add('bg-red-100');
        if(actionsCard) actionsCard.classList.add('border-red-600');
        if(h2) h2.classList.add('text-red-800');
    }
}

export async function fetchCameraFeed() {
    const container = document.querySelector('#home-view .aspect-w-16'); 
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/public/alerts/camera`);
        const data = await response.json();
        
        if (data.img_base64 && data.img_base64 !== "") {
            container.innerHTML = `
                <img src="data:image/jpeg;base64,${data.img_base64}" 
                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.5rem;"
                     alt="Live River Feed" />
            `;
        } else {
            // Keep placeholder (loading/offline state)
        }
    } catch (error) {
        console.error("Camera fetch failed", error);
    }
}