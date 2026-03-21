import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { getUser, clearUser } from '../services/auth.js';
import {
    fetchAlertStatus, fetchCameraFeed as fetchCameraAPI, fetchTidesData,
    fetchActiveResidents, deleteResident as deleteResidentAPI,
    fetchTemplates as fetchTemplatesAPI, saveTemplate as saveTemplateAPI,
    fetchSensorData
} from '../services/api.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export default function Admin() {
    const navigate = useNavigate();

    // Auth Guard
    const user = getUser();
    const role = user && user.role ? String(user.role).toUpperCase().trim() : "";

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) {
            console.warn("Unauthorized access detected. Redirecting...");
            alert("Access Denied. Admins Only.");
            navigate('/');
            return;
        }
    }, []);

    // State
    const [activeView, setActiveView] = useState('dashboard');
    const [dashData, setDashData] = useState({ waterLevel: '-- m', status: 'Normal', statusColor: 'text-green-600', prediction: '-- m', predTrend: 'Calculating...', predColor: 'text-gray-500', subscriberCount: 0 });
    const [cameraImg, setCameraImg] = useState(null);
    const [tides, setTides] = useState([]);
    const [residents, setResidents] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [chartData, setChartData] = useState({ labels: [], datasets: [{ label: 'Water Level (Meters)', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, fill: true, tension: 0.4 }] });

    const displayName = user ? (user.fullName || user.username) : 'Admin';

    // Data Loading
    const loadDashboardData = async () => {
        try {
            const data = await fetchAlertStatus();
            const newDash = { ...dashData };

            newDash.waterLevel = (data.waterLevelM !== null && data.waterLevelM !== undefined) ? data.waterLevelM.toFixed(2) + ' m' : '--';

            const level = data.alertLevel || 'OFFLINE';
            newDash.status = level;
            if (level === 'RED') newDash.statusColor = 'text-red-600';
            else if (level === 'ORANGE') newDash.statusColor = 'text-orange-500';
            else if (level === 'YELLOW') newDash.statusColor = 'text-yellow-500';
            else if (level === 'GREEN') newDash.statusColor = 'text-green-600';
            else newDash.statusColor = 'text-gray-500';

            if (data.waterLevelM !== null) {
                const val = (data.predictedLevel !== null) ? data.predictedLevel : data.waterLevelM;
                newDash.prediction = val.toFixed(2) + ' m';
            } else {
                newDash.prediction = '--';
            }

            if (data.alertLevel !== 'OFFLINE') {
                const pLevel = data.predictedAlertLevel || "Stable";
                newDash.predTrend = `Trend: ${pLevel}`;
                if (pLevel === 'RED') newDash.predColor = 'text-red-600';
                else if (pLevel === 'ORANGE') newDash.predColor = 'text-orange-500';
                else if (pLevel === 'YELLOW') newDash.predColor = 'text-yellow-500';
                else newDash.predColor = 'text-green-600';
            }

            try {
                const res = await fetchActiveResidents();
                newDash.subscriberCount = res.length;
            } catch (e) { }

            setDashData(newDash);
        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    };

    const loadCameraFeed = async () => {
        try {
            const data = await fetchCameraAPI();
            if (data.img_base64 && data.img_base64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${data.img_base64}`);
            }
        } catch (e) { console.error("Camera fetch error:", e); }
    };

    const loadTideData = async () => {
        try {
            const data = await fetchTidesData();
            if (data.extremes) setTides(data.extremes);
        } catch (e) { console.error(e); }
    };

    const loadChartData = async () => {
        try {
            const data = await fetchSensorData(24);
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            const labels = data.map(d => {
                const date = new Date(d.timestamp);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });
            const values = data.map(d => d.waterLevelM);

            setChartData(prev => ({
                ...prev,
                labels,
                datasets: [{ ...prev.datasets[0], data: values }]
            }));
        } catch (e) { console.error("Failed to update chart:", e); }
    };

    const loadResidents = async () => {
        try {
            const data = await fetchActiveResidents();
            setResidents(data);
        } catch (e) { console.error(e); }
    };

    const loadTemplates = async () => {
        try {
            const data = await fetchTemplatesAPI();
            setTemplates(data);
        } catch (e) { console.error(e); }
    };

    const handleDeleteResident = async (phone) => {
        if (!window.confirm('Are you sure you want to delete ' + phone + '?')) return;
        try {
            await deleteResidentAPI(phone);
            loadResidents();
            loadDashboardData();
        } catch (e) { alert('Delete failed'); }
    };

    const handleSaveTemplate = async (type, template) => {
        try {
            await saveTemplateAPI(type, template);
            alert(`${type} Template updated!`);
        } catch (e) { alert("Failed update."); }
    };

    const handleLogout = () => {
        clearUser();
        navigate('/');
    };

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;

        loadDashboardData();
        loadCameraFeed();
        loadTideData();
        loadChartData();
        loadResidents();
        loadTemplates();

        const pollInterval = setInterval(() => {
            loadDashboardData();
            loadCameraFeed();
            loadChartData();
        }, 3000);

        const tideInterval = setInterval(loadTideData, 3600000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(tideInterval);
        };
    }, []);

    const switchView = (viewName) => setActiveView(viewName);

    const navItems = [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge' },
        { key: 'residents', label: 'Residents', icon: 'fa-users' },
        { key: 'templates', label: 'SMS Templates', icon: 'fa-comment-sms' },
    ];

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return `Level: ${context.parsed.y.toFixed(2)} m`;
                    }
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
            y: { beginAtZero: true, title: { display: true, text: 'Meters' }, grid: { borderDash: [2, 4] } }
        }
    };

    if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return null;

    return (
        <div className="flex h-screen overflow-hidden">

            {/* SIDEBAR */}
            <aside className="w-64 bg-navy text-white flex flex-col shadow-lg transition-all duration-300" id="sidebar">
                <div className="p-6 flex items-center justify-center border-b border-gray-700">
                    <i className="fa-solid fa-water text-2xl mr-2 text-teal-400"></i>
                    <span className="text-xl font-bold tracking-wide">SurgeAlert</span>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-gray-700 bg-opacity-50 bg-black">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center text-lg font-bold">A</div>
                        <div>
                            <p className="text-sm font-semibold" id="admin-name">{displayName}</p>
                            <p className="text-xs text-gray-400" id="admin-role">{role}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4">
                    <ul className="space-y-1 px-2">
                        {navItems.map(item => (
                            <li key={item.key}>
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); switchView(item.key); }}
                                    className={`nav-item flex items-center p-3 rounded-lg hover:bg-gray-700 transition ${activeView === item.key ? 'active bg-teal text-white' : ''}`}
                                >
                                    <i className={`fa-solid ${item.icon} w-6 text-center`}></i>
                                    <span className="ml-3">{item.label}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-gray-700">
                    <button id="admin-logout" onClick={handleLogout} className="w-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition">
                        <i className="fa-solid fa-right-from-bracket mr-2"></i> Logout
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto relative">
                <div className="p-6">

                    {/* 1. DASHBOARD */}
                    {activeView === 'dashboard' && (
                        <div id="view-dashboard" className="view-section">
                            <h1 className="text-2xl font-bold text-navy mb-6">System Dashboard</h1>

                            {/* TOP METRICS GRID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                {/* Water Level */}
                                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-blue-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Current Level</p>
                                            <h3 className="text-2xl font-bold text-gray-800" id="dash-water-level">{dashData.waterLevel}</h3>
                                        </div>
                                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><i className="fa-solid fa-water"></i></div>
                                    </div>
                                </div>

                                {/* AI Prediction */}
                                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-indigo-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">AI Prediction (+1hr)</p>
                                            <h3 className="text-2xl font-bold text-gray-800" id="dash-prediction">{dashData.prediction}</h3>
                                            <p className={`text-xs font-semibold mt-1 ${dashData.predColor}`} id="dash-pred-alert">{dashData.predTrend}</p>
                                        </div>
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><i className="fa-solid fa-brain"></i></div>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-green-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">System Status</p>
                                            <h3 className={`text-2xl font-bold ${dashData.statusColor}`} id="dash-status">{dashData.status}</h3>
                                        </div>
                                        <div className="p-2 bg-green-100 rounded-lg text-green-600"><i className="fa-solid fa-signal"></i></div>
                                    </div>
                                </div>

                                {/* Subscribers */}
                                <div className="bg-white p-5 rounded-xl shadow border-l-4 border-purple-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Subscribers</p>
                                            <h3 className="text-2xl font-bold text-gray-800" id="dash-users-count">{dashData.subscriberCount}</h3>
                                        </div>
                                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><i className="fa-solid fa-users"></i></div>
                                    </div>
                                </div>
                            </div>

                            {/* GRAPH ROW */}
                            <div className="bg-white p-5 rounded-xl shadow mb-8">
                                <h3 className="text-lg font-bold text-navy mb-4 border-b pb-2">24-Hour Water Level Trend</h3>
                                <div className="relative" style={{ height: '350px', width: '100%' }}>
                                    <Line data={chartData} options={chartOptions} />
                                </div>
                            </div>

                            {/* MEDIA & TIDES ROW */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                {/* Live Camera Feed */}
                                <div className="bg-white p-5 rounded-xl shadow lg:col-span-2">
                                    <h3 className="text-lg font-bold text-navy mb-4 border-b pb-2">Live Camera Feed</h3>
                                    <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ height: '400px' }}>
                                        {cameraImg ? (
                                            <img id="admin-camera-image" src={cameraImg} alt="Live Feed" className="object-cover w-full h-full" />
                                        ) : (
                                            <div id="admin-camera-placeholder" className="text-gray-400">Waiting for live feed...</div>
                                        )}
                                    </div>
                                </div>

                                {/* Tide Forecast */}
                                <div className="bg-white p-5 rounded-xl shadow">
                                    <h3 className="text-lg font-bold text-navy mb-4 border-b pb-2">Tide Forecast</h3>
                                    <div id="admin-tides-list" className="space-y-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
                                        {tides.length === 0 ? (
                                            <p className="text-sm text-gray-500">Loading tide data...</p>
                                        ) : (
                                            tides.map((tide, i) => {
                                                const date = new Date(tide.dt * 1000);
                                                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                const typeColor = tide.type === 'High' ? 'text-blue-600' : 'text-teal-600';
                                                const icon = tide.type === 'High' ? 'fa-arrow-up' : 'fa-arrow-down';

                                                return (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                        <div className="flex items-center">
                                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-300 mr-3">
                                                                <i className={`fa-solid ${icon} ${typeColor}`}></i>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-800">{tide.type} Tide</p>
                                                                <p className="text-xs text-gray-500">{timeStr}</p>
                                                            </div>
                                                        </div>
                                                        <span className="font-mono font-bold text-gray-700">{tide.height.toFixed(2)}m</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. RESIDENTS VIEW */}
                    {activeView === 'residents' && (
                        <div id="view-residents" className="view-section">
                            <h1 className="text-2xl font-bold text-navy mb-6">Registered Residents</h1>
                            <div className="bg-white rounded-xl shadow overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200" id="user-table-body">
                                        {residents.map((res, i) => (
                                            <tr key={i}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{res.fullName || 'N/A'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.phoneNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.address || 'N/A'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span></td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <button className="text-red-600 hover:text-red-900" onClick={() => handleDeleteResident(res.phoneNumber)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 3. TEMPLATES VIEW */}
                    {activeView === 'templates' && (
                        <div id="view-templates" className="view-section">
                            <h1 className="text-2xl font-bold text-navy mb-6">Manage SMS Templates</h1>
                            <div className="grid grid-cols-1 gap-6" id="templates-container">
                                {templates.length === 0 ? (
                                    <div className="text-gray-500">Loading templates...</div>
                                ) : (
                                    templates.map((tpl, i) => (
                                        <TemplateCard key={i} tpl={tpl} onSave={handleSaveTemplate} />
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}

// Template Card sub-component
function TemplateCard({ tpl, onSave }) {
    const [value, setValue] = useState(tpl.template);

    return (
        <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-navy">{tpl.alertType} ALERT</h3>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded">ID: {tpl.id}</span>
            </div>
            <textarea
                id={`tpl-${tpl.alertType}`}
                rows="4"
                className="w-full border border-gray-300 rounded p-2 text-sm mb-4"
                value={value}
                onChange={(e) => setValue(e.target.value)}
            ></textarea>
            <div className="flex justify-end">
                <button onClick={() => onSave(tpl.alertType, value)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Save Changes</button>
            </div>
        </div>
    );
}
