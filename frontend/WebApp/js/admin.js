import { API_BASE_URL } from './config.js';
import { handleLogout, getUser } from './auth.js';
import { initWaterLevelChart, updateChartData } from './charts.js'; // NEW IMPORT

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Guard (Security)
    const user = getUser();
    const role = user && user.role ? String(user.role).toUpperCase().trim() : "";

    console.log("Admin Page Loaded. User:", user);
    
    // Strict Admin Check
    if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) {
        console.warn("Unauthorized access detected. Redirecting...");
        alert("Access Denied. Admins Only.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Setup UI Info
    const displayName = user.fullName ? user.fullName : user.username;
    const nameEl = document.getElementById('admin-name');
    const roleEl = document.getElementById('admin-role');
    
    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = role;
    
    // Logout Logic
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // 3. Initial Data Load
    loadDashboardData();
    loadCameraFeed();
    loadTideData();
    initWaterLevelChart(); // NEW: Load Graph
    loadResidents();
    loadTemplates();

    // 4. Polling (Refresh data every 3 seconds)
    setInterval(() => {
        loadDashboardData();
        loadCameraFeed();
        updateChartData(); // NEW: Refresh Graph Data
    }, 3000);

    // Refresh Tides every hour (they don't change often)
    setInterval(loadTideData, 3600000);
});

// --- DASHBOARD DATA ---
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/public/alerts/status`);
        if (!response.ok) return; 
        const data = await response.json();

        // 1. Water Level
        const waterEl = document.getElementById('dash-water-level');
        if (waterEl) {
            waterEl.textContent = (data.waterLevelM !== null && data.waterLevelM !== undefined) 
                ? data.waterLevelM.toFixed(2) + ' m' 
                : '--';
        }

        // 2. Status Color Coding
        const statusEl = document.getElementById('dash-status');
        if (statusEl) {
            const level = data.alertLevel || 'OFFLINE';
            statusEl.textContent = level;
            statusEl.className = 'text-2xl font-bold'; 
            if (level === 'RED') statusEl.classList.add('text-red-600');
            else if (level === 'ORANGE') statusEl.classList.add('text-orange-500');
            else if (level === 'YELLOW') statusEl.classList.add('text-yellow-500');
            else if (level === 'GREEN') statusEl.classList.add('text-green-600');
            else statusEl.classList.add('text-gray-500');
        }

        // 3. AI Prediction (THIS WAS MISSING BEFORE)
        const predEl = document.getElementById('dash-prediction');
        const predAlertEl = document.getElementById('dash-pred-alert');
        
        if (predEl) {
            if (data.waterLevelM !== null) {
                // If we have data, show prediction (or current level if prediction is missing)
                const val = (data.predictedLevel !== null) ? data.predictedLevel : data.waterLevelM;
                predEl.textContent = val.toFixed(2) + ' m';
            } else {
                predEl.textContent = "--";
            }
        }

        if (predAlertEl && data.alertLevel !== 'OFFLINE') {
             // Show alert level of prediction (or standard text)
             const pLevel = data.predictedAlertLevel || "Stable";
             predAlertEl.textContent = `Trend: ${pLevel}`;
             
             // Color code
             predAlertEl.className = 'text-xs font-semibold mt-1';
             if(pLevel === 'RED') predAlertEl.classList.add('text-red-600');
             else if(pLevel === 'ORANGE') predAlertEl.classList.add('text-orange-500');
             else if(pLevel === 'YELLOW') predAlertEl.classList.add('text-yellow-500');
             else predAlertEl.classList.add('text-green-600');
        }

        // 4. Subscriber Count
        const resResponse = await fetch(`${API_BASE_URL}/residents/active`);
        if (resResponse.ok) {
            const residents = await resResponse.json();
            const countEl = document.getElementById('dash-users-count');
            if (countEl) countEl.textContent = residents.length;
        }

    } catch (e) {
        console.error("Dashboard Load Error:", e);
    }
}

// --- CAMERA FEED ---
async function loadCameraFeed() {
    const imgEl = document.getElementById('admin-camera-image');
    const placeholder = document.getElementById('admin-camera-placeholder');
    if (!imgEl) return;

    try {
        const response = await fetch(`${API_BASE_URL}/public/alerts/camera`);
        const data = await response.json();

        if (data.img_base64 && data.img_base64 !== "") {
            imgEl.src = `data:image/jpeg;base64,${data.img_base64}`;
            imgEl.classList.remove('hidden');
            if(placeholder) placeholder.classList.add('hidden');
        }
    } catch (e) {
        console.error("Camera fetch error:", e);
    }
}

// --- TIDE DATA ---
async function loadTideData() {
    const container = document.getElementById('admin-tides-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/external/tides`);
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();

        if (data.error) {
            container.innerHTML = `<p class="text-red-500 text-sm">${data.error}</p>`;
            return;
        }

        let html = '';
        if (data.extremes && data.extremes.length > 0) {
            data.extremes.forEach(tide => {
                const date = new Date(tide.dt * 1000);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const typeColor = tide.type === 'High' ? 'text-blue-600' : 'text-teal-600';
                const icon = tide.type === 'High' ? 'fa-arrow-up' : 'fa-arrow-down';

                html += `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-300 mr-3">
                            <i class="fa-solid ${icon} ${typeColor}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-gray-800">${tide.type} Tide</p>
                            <p class="text-xs text-gray-500">${timeStr}</p>
                        </div>
                    </div>
                    <span class="font-mono font-bold text-gray-700">${tide.height.toFixed(2)}m</span>
                </div>`;
            });
        } else {
            html = '<p class="text-gray-500">No tide data available.</p>';
        }
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<p class="text-red-500 text-sm">Unavailable.</p>';
    }
}

// --- RESIDENTS ---
async function loadResidents() {
    try {
        const response = await fetch(`${API_BASE_URL}/residents/active`);
        if (!response.ok) return;
        const residents = await response.json();

        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        residents.forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${res.fullName || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${res.phoneNumber}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-red-600 hover:text-red-900" onclick="deleteResident(${res.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// --- GLOBAL FUNCTIONS (View Switching / Delete / Save) ---
window.switchView = function(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-teal', 'text-white');
        if(el.getAttribute('onclick').includes(viewName)) {
            el.classList.add('active', 'bg-teal', 'text-white');
        }
    });
};

window.deleteResident = async (id) => {
    if (!confirm('Remove this subscriber (ID ' + id + ')?')) return;
    try {
        await fetch(`${API_BASE_URL}/residents/id/${id}`, { method: 'DELETE' });
        loadResidents();
        loadDashboardData();
    } catch (e) { alert('Delete failed'); }
};

window.saveTemplate = async (type) => {
    const textArea = document.getElementById(`tpl-${type}`);
    if (!textArea) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/templates/${type}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: textArea.value })
        });
        if (response.ok) alert(`${type} Template updated!`);
        else alert("Failed update.");
    } catch (e) { alert("Network error."); }
};

async function loadTemplates() {
    const container = document.getElementById('templates-container');
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/templates`);
        const templates = await response.json();
        container.innerHTML = '';
        templates.forEach(tpl => {
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-xl shadow";
            card.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-navy">${tpl.alertType} ALERT</h3>
                    <span class="text-xs bg-gray-200 px-2 py-1 rounded">ID: ${tpl.id}</span>
                </div>
                <textarea id="tpl-${tpl.alertType}" rows="4" class="w-full border border-gray-300 rounded p-2 text-sm mb-4">${tpl.template}</textarea>
                <div class="flex justify-end">
                    <button onclick="saveTemplate('${tpl.alertType}')" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Save Changes</button>
                </div>`;
            container.appendChild(card);
        });
    } catch (e) { container.innerHTML = '<p class="text-red-500">Error loading templates.</p>'; }
}