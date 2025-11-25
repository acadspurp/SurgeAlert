import { API_BASE_URL } from './config.js';
import { handleLogout, getUser } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Guard
    const user = getUser();
    console.log("Current Admin User:", user); // Debug Log

    if (!user || (user.role !== 'ADMIN' && user.role !== 'HEAD_ADMIN')) {
        alert("Access Denied. Admins Only.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Setup UI
    // Use fullName from DB, if null use username
    document.getElementById('admin-name').textContent = user.fullName || user.username;
    document.getElementById('admin-role').textContent = user.role;
    document.getElementById('admin-logout').addEventListener('click', handleLogout);

    // 3. Tab Switching
    window.switchView = function(viewName) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById('view-' + viewName);
        if(target) target.classList.remove('hidden');
        
        // Update Sidebar Active State
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active', 'bg-teal', 'text-white'));
    };

    // 4. Load Initial Data
    loadDashboardData();
    loadResidents();
    loadTemplates();

    // Auto-refresh Dashboard every 5 seconds
    setInterval(loadDashboardData, 5000);
});

// --- DASHBOARD DATA ---
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/public/alerts/status`);
        const data = await response.json();
        
        // Update Stats
        document.getElementById('dash-water-level').textContent = (data.waterLevelM !== null) ? data.waterLevelM.toFixed(2) + ' m' : '--';
        const statusEl = document.getElementById('dash-status');
        statusEl.textContent = data.alertLevel || 'OFFLINE';
        
        // Color coding for status
        statusEl.className = 'text-2xl font-bold';
        if(data.alertLevel === 'RED') statusEl.classList.add('text-red-600');
        else if(data.alertLevel === 'ORANGE') statusEl.classList.add('text-orange-500');
        else if(data.alertLevel === 'YELLOW') statusEl.classList.add('text-yellow-500');
        else statusEl.classList.add('text-green-600');

        // Count Residents
        const resResponse = await fetch(`${API_BASE_URL}/residents/active`);
        if(resResponse.ok) {
            const residents = await resResponse.json();
            document.getElementById('dash-users-count').textContent = residents.length;
        }

    } catch(e) { console.error("Dashboard Load Error:", e); }
}

// --- RESIDENTS MANAGEMENT ---
async function loadResidents() {
    try {
        const response = await fetch(`${API_BASE_URL}/residents/active`);
        if(!response.ok) return;
        const residents = await response.json();
        
        const tbody = document.getElementById('user-table-body');
        tbody.innerHTML = '';
        
        residents.forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${res.fullName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${res.phoneNumber}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${res.address}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-red-600 hover:text-red-900" onclick="deleteResident('${res.phoneNumber}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) { console.error("Residents Load Error:", e); }
}

window.deleteResident = async (phone) => {
    if(!confirm('Are you sure you want to delete ' + phone + '?')) return;
    try {
        await fetch(`${API_BASE_URL}/residents/${phone}`, { method: 'DELETE' });
        loadResidents(); 
    } catch(e) { alert('Delete failed'); }
};

// --- ALERT TEMPLATES MANAGEMENT ---
async function loadTemplates() {
    const container = document.getElementById('templates-container');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/templates`);
        if(!response.ok) throw new Error("Failed to load templates");
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
                </div>
            `;
            container.appendChild(card);
        });
        
    } catch (e) {
        if(container) container.innerHTML = `<p class="text-red-500">Error loading templates. Ensure you are logged in as Admin.</p>`;
        console.error(e);
    }
}

window.saveTemplate = async (type) => {
    const textArea = document.getElementById(`tpl-${type}`);
    if(!textArea) return;
    
    const newTemplate = textArea.value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/templates/${type}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: newTemplate })
        });
        
        if(response.ok) {
            alert(`${type} Template updated successfully!`);
        } else {
            alert("Failed to update template.");
        }
    } catch(e) {
        alert("Network error updating template.");
    }
};