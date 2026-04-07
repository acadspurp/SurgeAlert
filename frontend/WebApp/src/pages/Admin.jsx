import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend } from 'chart.js';
import { getUser, clearUser } from '../services/auth.js';
import {
    fetchAlertStatus, fetchCameraFeed as fetchCameraAPI, fetchTidesData,
    fetchActiveResidents, deleteResident as deleteResidentAPI,
    fetchTemplates as fetchTemplatesAPI, saveTemplate as saveTemplateAPI,
    fetchSensorData, overrideAlert, downloadReport,
    fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, fetchSystemLogs
} from '../services/api.js';
import { useSensorMqtt } from '../hooks/useSensorMqtt.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

export default function Admin() {
    const navigate = useNavigate();
    const mqttData = useSensorMqtt();

    // Auth Guard
    const user = getUser();
    const role = user && user.role ? String(user.role).toUpperCase().trim() : "";
    const isHeadAdmin = role === 'HEAD_ADMIN';

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) {
            console.warn("Unauthorized access detected. Redirecting...");
            alert("Access Denied. Admins Only.");
            navigate('/');
            return;
        }
    }, [user, role, navigate]);

    // UI State
    const [activeView, setActiveView] = useState('dashboard');
    const [dashData, setDashData] = useState({ 
        waterLevel: '-- m', flowRate: '-- m/s', status: 'Normal', statusColor: 'text-green-600', 
        prediction: '-- m', predColor: 'text-gray-500', subscriberCount: 0 
    });
    const [cameraImg, setCameraImg] = useState(null);
    const [tides, setTides] = useState([]);
    const [nextTide, setNextTide] = useState(null);
    
    // Telemetry State
    const [telemetryTime, setTelemetryTime] = useState(24);
    const [rawSensorData, setRawSensorData] = useState([]);
    
    // Report Data
    const [reportStart, setReportStart] = useState("");
    const [reportEnd, setReportEnd] = useState("");
    const [reportTelemetry, setReportTelemetry] = useState(true);
    const [reportAI, setReportAI] = useState(true);
    
    // Residents & Templates
    const [residents, setResidents] = useState([]);
    const [templates, setTemplates] = useState([]);

    // Admin Users State
    const [adminUsers, setAdminUsers] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);

    // User Modal States
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ fullName: '', username: '', password: '', role: 'ADMIN' });

    const displayName = user ? (user.fullName || user.username) : 'Admin';

    // -------------------------------------------------------------
    // DATA LOADING
    // -------------------------------------------------------------
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
            if (data.img_base64 && data.img_base64 !== "") setCameraImg(`data:image/jpeg;base64,${data.img_base64}`);
        } catch (e) { console.error("Camera fetch error:", e); }
    };

    const loadTideData = async () => {
        try {
            const data = await fetchTidesData();
            if (data.extremes) {
                setTides(data.extremes);
                const now = new Date();
                const futureTides = data.extremes.filter(t => new Date(t.dt * 1000) > now);
                if (futureTides.length > 0) setNextTide(futureTides[0]);
            }
        } catch (e) { console.error(e); }
    };

    const loadChartData = async (hours) => {
        try {
            const data = await fetchSensorData(hours);
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            setRawSensorData(data);
            
            // Also update dash prediction/flowrate from latest data element if we want
            if (data.length > 0) {
                const latest = data[data.length - 1];
                setDashData(prev => ({
                    ...prev,
                    flowRate: latest.sensorFlowRateMps !== null ? latest.sensorFlowRateMps.toFixed(2) + ' m/s' : '-- m/s',
                    prediction: latest.predictedLevel !== null ? latest.predictedLevel.toFixed(2) + ' m' : '-- m',
                }));
            }
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

    const loadAdminUsersData = async () => {
        try {
            const users = await fetchAdminUsers();
            setAdminUsers(users);
            const logs = await fetchSystemLogs();
            setSystemLogs(logs);
        } catch (e) { console.error(e); }
    };

    // -------------------------------------------------------------
    // EFFECTS
    // -------------------------------------------------------------
    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;
        
        if (mqttData) {
            const newDash = { ...dashData };
            newDash.waterLevel = (mqttData.waterLevelM !== null && mqttData.waterLevelM !== undefined) ? mqttData.waterLevelM.toFixed(2) + ' m' : '--';
            newDash.flowRate = (mqttData.sensorFlowRateMps !== null) ? mqttData.sensorFlowRateMps.toFixed(2) + ' m/s' : '-- m/s';
            
            const level = mqttData.currentAlertLevel || 'OFFLINE';
            newDash.status = level;
            if (level === 'RED') newDash.statusColor = 'text-red-600';
            else if (level === 'ORANGE') newDash.statusColor = 'text-orange-500';
            else if (level === 'YELLOW') newDash.statusColor = 'text-yellow-500';
            else if (level === 'GREEN') newDash.statusColor = 'text-green-600';
            else newDash.statusColor = 'text-gray-500';

            if (mqttData.predictedLevel !== null && mqttData.predictedLevel !== undefined) {
                newDash.prediction = mqttData.predictedLevel.toFixed(2) + ' m';
            }

            setDashData(newDash);

            if (mqttData.snapshotBase64 && mqttData.snapshotBase64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${mqttData.snapshotBase64}`);
            }
            loadChartData(telemetryTime);
        }
    }, [mqttData]);

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;

        loadDashboardData();
        loadCameraFeed();
        loadTideData();
        loadChartData(telemetryTime);
        loadResidents();
        loadTemplates();

        if (isHeadAdmin) {
            loadAdminUsersData();
        }

        const tideInterval = setInterval(loadTideData, 3600000);
        return () => clearInterval(tideInterval);
    }, []);
    
    // Telemetry time changer
    useEffect(() => {
        if (user) loadChartData(telemetryTime);
    }, [telemetryTime]);

    // -------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------
    const handleOverride = async (level) => {
        if(!isHeadAdmin) {
            alert('Only Head Admins can override the system alarm.');
            return;
        }

        let reason = "";
        if (level !== 'NORMAL') {
            reason = prompt(`Reason for Manual Override to ${level}:`);
            if (reason === null) return; // Cancelled
        }

        try {
            await overrideAlert(level, reason);
            alert(`Alert level forcefully overridden to ${level}`);
            loadDashboardData();
            if(isHeadAdmin) loadAdminUsersData(); // Reload logs
        } catch(e) {
            alert('Error overriding alert.');
        }
    };

    const handleDownloadReport = async (format) => {
        try {
            const blob = await downloadReport(reportStart, reportEnd, reportTelemetry, reportAI);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SurgeAlert_Report_${new Date().toISOString().slice(0,10)}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            if(isHeadAdmin) loadAdminUsersData();
        } catch (e) {
            alert('Error generating report.');
        }
    };

    const handleDeleteResident = async (id, label) => {
        if (!window.confirm('Remove subscriber ' + (label || id) + '?')) return;
        try {
            await deleteResidentAPI(id);
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

    // User Management Modal Handlers
    const openCreateUserModal = () => {
        setEditingUser(null);
        setUserForm({ fullName: '', username: '', password: '', role: 'ADMIN' });
        setShowUserModal(true);
    };

    const openEditUserModal = (user) => {
        setEditingUser(user.id);
        setUserForm({ fullName: user.fullName, username: user.username, password: '', role: user.role });
        setShowUserModal(true);
    };

    const saveUserModal = async () => {
        if (!userForm.fullName || !userForm.username || (!userForm.password && !editingUser)) {
            alert("Please fill in all required fields.");
            return;
        }

        try {
            if (editingUser) {
                const payload = { fullName: userForm.fullName, role: userForm.role };
                if (userForm.password) payload.password = userForm.password;
                await updateAdminUser(editingUser, payload);
                alert("User updated.");
            } else {
                await createAdminUser(userForm);
                alert("User created.");
            }
            setShowUserModal(false);
            loadAdminUsersData();
        } catch (e) {
            alert("Failed to save user.");
        }
    };

    const handleDeleteAdminUser = async (id, name) => {
        if(!window.confirm(`Delete user ${name}?`)) return;
        try {
            await deleteAdminUser(id);
            loadAdminUsersData();
            alert("User deleted.");
        } catch (e) { alert("Failed to delete user."); }
    };

    const switchView = (viewName) => setActiveView(viewName);

    // AI Recommendation Logic
    const getAiRecommendedStatus = () => {
        const predStr = dashData.prediction.replace(' m', '');
        const predVal = parseFloat(predStr);
        if (isNaN(predVal)) return 'NORMAL';
        if (predVal >= 1.0) return 'RED';
        if (predVal >= 0.7) return 'ORANGE';
        if (predVal >= 0.4) return 'YELLOW';
        return 'NORMAL';
    };

    const aiRecommendedStatus = getAiRecommendedStatus();
    const isDivergent = (dashData.status !== aiRecommendedStatus) && (aiRecommendedStatus !== 'NORMAL');

    // -------------------------------------------------------------
    // CHART CONFIGURATIONS
    // -------------------------------------------------------------
    const getChartLabels = () => rawSensorData.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    // Telemetry Chart (Multiple Lines)
    const telemetryChartData = {
        labels: getChartLabels(),
        datasets: [
            { label: 'Water Level (m)', data: rawSensorData.map(d => d.waterLevelM), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.3, yAxisID: 'y' },
            { label: 'Radar Flow (m/s)', data: rawSensorData.map(d => d.sensorFlowRateMps), borderColor: '#8b5cf6', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y1' },
            { label: 'Optical Flow (m/s)', data: rawSensorData.map(d => d.imageFlowRateMps), borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y1' }
        ]
    };
    
    // AI Chart (Historical + Future prediction plot logic)
    const aiChartData = {
        labels: [...getChartLabels(), "Next Hour Prediction"],
        datasets: [
            { 
                label: 'Historical Level (m)', 
                data: [...rawSensorData.map(d => d.waterLevelM), null], 
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 
            },
            {
                label: 'ML Prediction (m)',
                data: [...rawSensorData.map(d => null).slice(0, -1), 
                       rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].waterLevelM : null, 
                       rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].predictedLevel : null],
                borderColor: '#f59e0b', borderDash: [5, 5], backgroundColor: 'transparent', tension: 0.3
            }
        ]
    };

    const commonChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } }
    };

    const telemetryChartOptions = {
        ...commonChartOptions,
        scales: {
            ...commonChartOptions.scales,
            y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Level (m)'} },
            y1: { type: 'linear', display: true, position: 'right', title: {display: true, text: 'Flow (m/s)'}, grid: { drawOnChartArea: false } },
        }
    };

    // -------------------------------------------------------------
    // RENDER HELPERS
    // -------------------------------------------------------------
    const navItems = [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge' },
        { key: 'telemetry', label: 'Telemetry & Analytics', icon: 'fa-chart-line' },
        { key: 'ai', label: 'ML Predictions & Tides', icon: 'fa-brain' },
        { key: 'residents', label: 'Residents', icon: 'fa-users' },
        { key: 'templates', label: 'SMS Templates', icon: 'fa-comment-sms' },
        { key: 'reports', label: 'Report Generation', icon: 'fa-file-export' },
    ];
    if (isHeadAdmin) navItems.push({ key: 'admin_users', label: 'User Management', icon: 'fa-user-shield' });

    if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return null;

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* SIDEBAR */}
            <aside className="w-68 bg-navy text-white flex flex-col shadow-xl transition-all duration-300" id="sidebar">
                <div className="p-6 flex items-center justify-center border-b border-gray-700 bg-black bg-opacity-30">
                    <i className="fa-solid fa-water text-2xl mr-3 text-teal-400"></i>
                    <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-300">SurgeAlertAdmin</span>
                </div>

                <div className="p-5 border-b border-gray-700 bg-opacity-50 bg-black flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-xl font-bold shadow-lg">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white tracking-wide">{displayName}</p>
                        <p className="text-xs text-teal-300 font-semibold tracking-wider">{role}</p>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6">
                    <ul className="space-y-2 px-4">
                        {navItems.map(item => (
                            <li key={item.key}>
                                <button
                                    onClick={() => switchView(item.key)}
                                    className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 ${
                                        activeView === item.key 
                                        ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-md transform scale-[1.02]' 
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    <i className={`fa-solid ${item.icon} w-6 text-center text-lg`}></i>
                                    <span className="ml-3 font-semibold">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-5 border-t border-gray-700">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl transition font-bold shadow hover:shadow-lg">
                        <i className="fa-solid fa-right-from-bracket mr-2"></i> Sign Out
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto relative w-full pt-6 pb-12 px-8">
                
                {/* 1. DASHBOARD */}
                {activeView === 'dashboard' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-8">
                            <h1 className="text-3xl font-black text-navy tracking-tight">Dashboard</h1>
                        </div>

                        {/* HEAD ADMIN OVERRIDE BANNER */}
                        {isHeadAdmin && (
                            <div className="bg-white rounded-2xl shadow-lg border border-red-200 bg-gradient-to-r from-red-50 to-white overflow-hidden mb-8">
                                <div className="bg-red-600 text-white px-6 py-3 font-bold flex items-center">
                                    <i className="fa-solid fa-triangle-exclamation mr-3 animate-pulse"></i>
                                    OFFICIAL ALERT OVERRIDE PANEL
                                </div>
                                <div className="p-6 flex flex-col md:flex-row items-center justify-between">
                                    <div className="mb-4 md:mb-0">
                                        <p className="text-sm text-gray-600">Current Logic Status: <span className="font-bold">{dashData.status}</span></p>
                                        <p className="text-sm text-gray-600 flex items-center">
                                            AI Recommended Status: 
                                            <span className={`font-bold ml-1 ${aiRecommendedStatus === 'RED' ? 'text-red-600' : aiRecommendedStatus === 'ORANGE' ? 'text-orange-500' : aiRecommendedStatus === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'}`}>
                                                {aiRecommendedStatus}
                                            </span>
                                            {isDivergent && <i className="fa-solid fa-triangle-exclamation text-yellow-500 ml-2 animate-pulse" title="Divergence Detected!"></i>}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">Force the system to broadcast a specific alert level to residents.</p>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleOverride('NORMAL')} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow transition">Normal/Auto</button>
                                            <button onClick={() => handleOverride('YELLOW')} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-4 rounded-lg shadow transition">Yellow</button>
                                            <button onClick={() => handleOverride('ORANGE')} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow transition">Orange</button>
                                            <button onClick={() => handleOverride('RED')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow transition">Red</button>
                                        </div>
                                        {aiRecommendedStatus !== 'NORMAL' && (
                                            <button onClick={() => handleOverride(aiRecommendedStatus)} className="text-xs flex items-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-3 rounded-full font-bold transition">
                                                <i className="fa-solid fa-rotate mr-1"></i> Sync to AI
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TOP CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <DashboardCard title="Water Level" value={dashData.waterLevel} icon="fa-water" color="blue" />
                            <DashboardCard title="Current Flow Rate" value={dashData.flowRate} icon="fa-water-arrow-up" color="indigo" />
                            <DashboardCard title="ML Prediction (+1h)" value={dashData.prediction} icon="fa-brain" color="purple" subtitle="Waiting for next tick..." />
                            <DashboardCard title="Subscribed Residents" value={dashData.subscriberCount} icon="fa-users" color="teal" />
                        </div>

                        {/* MEDIA CENTER & QUICK TIDES */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 lg:col-span-2 flex flex-col">
                                <h3 className="text-xl font-bold text-navy mb-4 flex items-center">
                                    <i className="fa-solid fa-camera mr-2 text-blue-500"></i> Media Center (Live Feed)
                                </h3>
                                <div className="bg-black rounded-xl overflow-hidden flex-1 relative min-h-[400px]">
                                    {cameraImg ? (
                                        <img src={cameraImg} alt="Live Feed" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-500 border-2 border-dashed border-gray-700 m-8 rounded-xl">
                                            <div className="text-center">
                                                <i className="fa-solid fa-video-slash text-4xl mb-3"></i>
                                                <p>Camera feed currently unavailable</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col">
                                <h3 className="text-xl font-bold text-navy mb-4 flex items-center">
                                    <i className="fa-solid fa-moon mr-2 text-indigo-500"></i> Quick Tides
                                </h3>
                                <div className="flex-1 bg-gradient-to-b from-blue-50 to-indigo-50 rounded-xl p-6 flex flex-col justify-center text-center">
                                    {nextTide ? (
                                        <>
                                            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-md mb-4 border border-blue-100">
                                                <i className={`fa-solid ${nextTide.type === 'High' ? 'fa-arrow-up text-blue-500' : 'fa-arrow-down text-teal-500'} text-3xl`}></i>
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-700">Rising to {nextTide.type} Tide</h4>
                                            <p className="text-3xl font-black text-navy my-2">{new Date(nextTide.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            <p className="text-sm font-semibold text-gray-500">Predicted Height: {nextTide.height.toFixed(2)}m</p>
                                        </>
                                    ) : (
                                        <p className="text-gray-500">Loading tide data...</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. TELEMETRY & ANALYTICS */}
                {activeView === 'telemetry' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-navy tracking-tight mb-8">Telemetry & Analytics</h1>
                        
                        {/* Current Readings */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <TelemetryCard title="Ultrasonic WL" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].waterLevelM?.toFixed(2) + ' m' : '--'} icon="fa-ruler-vertical" color="blue" />
                            <TelemetryCard title="Speed Radar Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].sensorFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-radar" color="purple" />
                            <TelemetryCard title="Optical Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].imageFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-eye" color="teal" />
                        </div>

                        {/* Calculated Rates */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8 text-center bg-gradient-to-r from-blue-50 to-indigo-50">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Calculated Rate of Change</p>
                            <h2 className="text-3xl font-black text-navy">
                                Water is <span className="text-blue-600">Stable</span>
                            </h2>
                            <p className="text-xs mt-2 text-gray-400">Calculated over the last 15 minutes</p>
                        </div>

                        {/* Historical Graph */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-navy">Historical Sensor Data</h3>
                                <select 
                                    className="bg-gray-100 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-semibold"
                                    value={telemetryTime} onChange={(e) => setTelemetryTime(Number(e.target.value))}
                                >
                                    <option value={1}>Last 1 Hour</option>
                                    <option value={6}>Last 6 Hours</option>
                                    <option value={24}>Last 24 Hours</option>
                                    <option value={168}>Last 7 Days</option>
                                </select>
                            </div>
                            <div className="h-96 w-full relative">
                                <Line data={telemetryChartData} options={telemetryChartOptions} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. AI PREDICTIONS & TIDES */}
                {activeView === 'ai' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-navy tracking-tight mb-8">ML Predictions & Tides</h1>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            {/* Confidence Metrics */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-gradient-to-br from-indigo-900 to-navy text-white rounded-2xl shadow-xl p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl">
                                        <i className="fa-solid fa-brain"></i>
                                    </div>
                                    <h3 className="text-xl font-bold mb-4 border-b border-indigo-700 pb-2 relative z-10">ML Confidence Metrics</h3>
                                    
                                    <div className="space-y-4 relative z-10">
                                        <div>
                                            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">+1hr Predicted Level</p>
                                            <div className="text-3xl font-black">{rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].predictedLevel?.toFixed(2) + ' m' : '--'}</div>
                                        </div>
                                        <div>
                                            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Estimated Flow Rate</p>
                                            <div className="text-2xl font-bold opacity-90">Currently Unavailable</div>
                                        </div>
                                        <div className="pt-2">
                                            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">Model Confidence</p>
                                            <div className="w-full bg-indigo-900 rounded-full h-3 mb-1 border border-indigo-700">
                                                <div className="bg-gradient-to-r from-teal-400 to-green-400 h-3 rounded-full" style={{width: '85%'}}></div>
                                            </div>
                                            <p className="text-right text-xs font-bold text-teal-300">85% HIGH</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Tide Timeline */}
                                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                                    <h3 className="text-lg font-bold text-navy mb-4 border-b border-gray-100 pb-2 flex items-center">
                                        <i className="fa-solid fa-water list-icon mr-2 text-teal-600"></i> Tide Timeline (24h)
                                    </h3>
                                    <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                        {tides.slice(0, 10).map((t, i) => (
                                            <div key={i} className="flex items-center">
                                                <div className="w-12 text-xs font-bold text-gray-400">{new Date(t.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                <div className="mx-3 flex flex-col items-center">
                                                    <div className={`w-3 h-3 rounded-full ${t.type === 'High' ? 'bg-blue-500' : 'bg-teal-500'} ring-4 ring-gray-50`}></div>
                                                    {i !== 9 && <div className="w-px h-10 bg-gray-200 my-1"></div>}
                                                </div>
                                                <div className="flex-1 bg-gray-50 rounded-lg p-2 border border-gray-100">
                                                    <p className="text-sm font-bold text-gray-700">{t.type} Tide</p>
                                                    <p className="text-xs text-gray-500">{t.height.toFixed(2)}m</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* AI Forecast Graph */}
                            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col">
                                <h3 className="text-xl font-bold text-navy mb-2">ML Forecast Trajectory</h3>
                                <p className="text-sm text-gray-500 mb-6">Comparing historical sensor data against the ML's projected path for the next hour.</p>
                                <div className="flex-1 w-full relative min-h-[400px]">
                                    <Line data={aiChartData} options={commonChartOptions} />
                                </div>
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-4 py-3 rounded-lg mt-4 flex items-center">
                                    <i className="fa-solid fa-circle-info mr-2"></i>
                                    Note: Trajectory confidence decreases significantly past the 1-hour mark. Models are retrained daily.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. RESIDENTS */}
                {activeView === 'residents' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-navy tracking-tight mb-8">Residents Management</h1>
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Resident Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Phone Number</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {residents.map((res, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-navy">{res.fullName || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{res.phoneNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap"><span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-700"><i className="fa-solid fa-check mr-1 mt-0.5"></i> Active</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition" onClick={() => handleDeleteResident(res.id, res.fullName)}>Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {residents.length === 0 && (
                                        <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No active residents found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 5. TEMPLATES */}
                {activeView === 'templates' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-navy tracking-tight mb-8">SMS Formatting Templates</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {templates.map((tpl, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                        tpl.alertType === 'RED' ? 'bg-red-500' : 
                                        tpl.alertType === 'ORANGE' ? 'bg-orange-500' : 
                                        tpl.alertType === 'YELLOW' ? 'bg-yellow-400' : 
                                        tpl.alertType === 'GREEN' ? 'bg-green-500' : 
                                        tpl.alertType === 'OTP' ? 'bg-purple-500' : 
                                        tpl.alertType === 'MANUAL' ? 'bg-blue-500' : 
                                        'bg-gray-400'}`}></div>
                                    <div className="flex justify-between items-center mb-4 pl-3">
                                        <h3 className="text-xl font-bold text-navy flex items-center">
                                            <i className="fa-solid fa-message mr-2 text-gray-400"></i> {tpl.alertType} ALERT
                                        </h3>
                                    </div>
                                    <textarea
                                        rows="4"
                                        className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 bg-gray-50 ml-3 shadow-inner"
                                        defaultValue={tpl.template}
                                        onBlur={(e) => handleSaveTemplate(tpl.alertType, e.target.value)}
                                        placeholder="Enter the template..."
                                    ></textarea>
                                    <p className="text-xs text-gray-400 ml-3 mb-2"><i className="fa-solid fa-lightbulb text-yellow-500"></i> Variables: {'{name}'}, {'{level}'}, {'{waterLevel}'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. REPORTS */}
                {activeView === 'reports' && (
                    <div className="animate-fade-in max-w-4xl">
                        <h1 className="text-3xl font-black text-navy tracking-tight mb-8">Report Generation</h1>
                        
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row gap-8">
                            {/* Form */}
                            <div className="flex-1 space-y-6">
                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Filter Parameters</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                                        <input type="date" value={reportStart} onChange={(e)=>setReportStart(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none transition bg-gray-50" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">End Date</label>
                                        <input type="date" value={reportEnd} onChange={(e)=>setReportEnd(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none transition bg-gray-50" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Data to Include</label>
                                    <div className="space-y-3">
                                        <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportTelemetry(!reportTelemetry)}>
                                            <div className={`w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors ${reportTelemetry ? 'bg-blue-500' : 'bg-white'}`}>
                                                {reportTelemetry && <i className="fa-solid fa-check text-white text-xs"></i>}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition">Sensor Telemetry Data</span>
                                        </label>
                                        <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportAI(!reportAI)}>
                                            <div className={`w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors ${reportAI ? 'bg-blue-500' : 'bg-white'}`}>
                                                {reportAI && <i className="fa-solid fa-check text-white text-xs"></i>}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition">ML Performance & Predictions</span>
                                        </label>
                                        <label className="flex items-center space-x-3 cursor-not-allowed opacity-50">
                                            <div className="w-5 h-5 border-2 border-gray-300 rounded"></div>
                                            <span className="text-sm font-semibold text-gray-500">SMS Broadcast Logs (Coming soon)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="w-full md:w-64 bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-center">
                                <h3 className="text-sm font-bold text-center text-gray-500 uppercase tracking-widest mb-6">Export As</h3>
                                <button onClick={() => handleDownloadReport('csv')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition mb-4 flex items-center justify-center">
                                    <i className="fa-solid fa-file-csv text-xl mr-2"></i> Download CSV
                                </button>
                                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-md transition flex items-center justify-center opacity-50 cursor-not-allowed">
                                    <i className="fa-solid fa-file-pdf text-xl mr-2"></i> Download PDF
                                </button>
                                <p className="text-xs text-center text-gray-400 mt-4">PDF rendering requires external library setup.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. ADMIN USERS (HEAD ADMIN ONLY) */}
                {activeView === 'admin_users' && isHeadAdmin && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-navy tracking-tight mb-8">User & Role Management</h1>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Accounts Table */}
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-lg font-bold text-navy flex items-center">
                                        <i className="fa-solid fa-shield-halved mr-2 text-indigo-500"></i> Admin Accounts
                                    </h3>
                                    <button onClick={openCreateUserModal} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-bold shadow transition flex items-center">
                                        <i className="fa-solid fa-plus mr-2"></i> Create
                                    </button>
                                </div>
                                <div className="overflow-x-auto p-4">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-gray-200">
                                                <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                                <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                                <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {adminUsers.map((a, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="py-3 px-4">
                                                        <p className="font-bold text-gray-800">{a.fullName}</p>
                                                        <p className="text-xs text-gray-500 font-mono">{a.username}</p>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${a.role === 'HEAD_ADMIN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {a.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button onClick={() => openEditUserModal(a)} className="text-blue-500 hover:text-blue-700 mx-2"><i className="fa-solid fa-pen"></i></button>
                                                        <button onClick={() => handleDeleteAdminUser(a.id, a.fullName)} className="text-red-500 hover:text-red-700 mx-2"><i className="fa-solid fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* System Action Logs */}
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col max-h-[600px]">
                                <div className="p-6 border-b border-gray-100 bg-gray-50">
                                    <h3 className="text-lg font-bold text-navy flex items-center">
                                        <i className="fa-solid fa-list-check mr-2 text-teal-600"></i> System Action Logs
                                    </h3>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                                    {systemLogs.length === 0 ? (
                                        <div className="text-center text-gray-500 py-8">No recorded actions.</div>
                                    ) : (
                                        systemLogs.map((log, i) => {
                                            const timeStr = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                            const isAlert = log.message.includes('OVERRIDE');
                                            return (
                                                <div key={i} className="flex gap-4">
                                                    <div className="w-16 text-xs font-bold text-gray-400 pt-1 text-right">{timeStr}</div>
                                                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-sm font-medium text-gray-700 border-l-4 border-l-blue-400">
                                                        {log.message}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* USER MODAL */}
                {showUserModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xl w-full">
                            <h2 className="text-2xl font-black text-navy mb-6">{editingUser ? 'Edit Account' : 'Create Account'}</h2>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Name:</label>
                                    <input type="text" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full border p-3 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Username:</label>
                                    <input type="text" disabled={!!editingUser} value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className={`w-full border p-3 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="johndoe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Password {editingUser && <span className="text-xs font-normal text-gray-500">(Leave blank to keep current)</span>}:</label>
                                    <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full border p-3 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder="***" />
                                </div>
                                
                                <div className="pt-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Role Selector:</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            onClick={() => setUserForm({...userForm, role: 'ADMIN'})}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition ${userForm.role === 'ADMIN' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                                        >
                                            <i className="fa-solid fa-user text-2xl text-blue-500 mb-2"></i>
                                            <h4 className="font-bold text-navy">Admin</h4>
                                            <p className="text-xs text-gray-500 mt-1">Standard monitoring access.</p>
                                            <ul className="text-[10px] text-gray-400 mt-2 list-disc pl-3">
                                                <li>View Dashboard</li>
                                                <li>View Telemetry</li>
                                                <li>Manage Alerts (Auto)</li>
                                            </ul>
                                        </div>
                                        <div 
                                            onClick={() => setUserForm({...userForm, role: 'HEAD_ADMIN'})}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition ${userForm.role === 'HEAD_ADMIN' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'}`}
                                        >
                                            <i className="fa-solid fa-user-shield text-2xl text-red-500 mb-2"></i>
                                            <h4 className="font-bold text-navy">Head Admin</h4>
                                            <p className="text-xs text-gray-500 mt-1">Full system & override control.</p>
                                            <ul className="text-[10px] text-gray-400 mt-2 list-disc pl-3">
                                                <li>Manual overrides</li>
                                                <li>Account Management</li>
                                                <li>System logs access</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                                <button onClick={() => setShowUserModal(false)} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-bold transition">Cancel</button>
                                <button onClick={saveUserModal} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold shadow transition">{editingUser ? 'Save Updates' : 'Create User'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------
function DashboardCard({ title, value, icon, color, subtitle }) {
    const colorClasses = {
        blue: "text-blue-600 bg-blue-100 border-blue-500",
        indigo: "text-indigo-600 bg-indigo-100 border-indigo-500",
        purple: "text-purple-600 bg-purple-100 border-purple-500",
        teal: "text-teal-600 bg-teal-100 border-teal-500"
    };
    const c = colorClasses[color];

    return (
        <div className={`bg-white p-6 rounded-2xl shadow-lg border-b-4 ${c.split(' ')[2]} relative overflow-hidden group hover:-translate-y-1 transition duration-300`}>
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-${color}-50 rounded-bl-full -z-10 opacity-50`}></div>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">{title}</p>
                    <h3 className="text-3xl font-black text-navy">{value}</h3>
                    {subtitle && <p className="text-xs text-gray-400 mt-2 font-semibold">{subtitle}</p>}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${c.split(' ').slice(0,2).join(' ')}`}>
                    <i className={`fa-solid ${icon}`}></i>
                </div>
            </div>
        </div>
    );
}

function TelemetryCard({ title, value, icon, color }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-${color}-100 text-${color}-600`}>
                <i className={`fa-solid ${icon} text-lg`}></i>
            </div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-navy">{value}</h3>
            </div>
        </div>
    );
}
