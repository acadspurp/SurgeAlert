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
    fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, fetchSystemLogs, fetchEvacuationSites,
    fetchPendingDatasetRequests, approveDatasetRequest, registerResident
} from '../services/api.js';
import { useSensorMqtt } from '../hooks/useSensorMqtt.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import Papa from 'papaparse';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend, annotationPlugin);

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
        prediction: '-- m', predColor: 'text-slate-400', subscriberCount: 0 
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
    const [isAddingResident, setIsAddingResident] = useState(false);
    const [newResidentState, setNewResidentState] = useState({ name: '', phone: '' });
    const [templates, setTemplates] = useState([]);
    const [editingTemplateType, setEditingTemplateType] = useState(null);
    const [templateDrafts, setTemplateDrafts] = useState({});
    
    // Formatters for user-friendly SMS templates
    const backendToUI = (str) => {
        if (!str) return '';
        return str
            .replace(/\{level\}/g, '[Current Water Height]')
            .replace(/\{waterLevel\}/g, '[Current Water Height]')
            .replace(/\{status\}/g, '[Alert Color]')
            .replace(/\{timestamp\}/g, '[Time Recorded]')
            .replace(/\{name\}/g, '[Resident Name]')
            .replace(/\{otp\}/g, '[OTP Code]')
            .replace(/\{code\}/g, '[OTP Code]')
            .replace(/\{message\}/g, '[Manual Message]')
            .replace(/\[?%s\]?/g, '[Time Recorded]');
    };

    const uiToBackend = (str) => {
        if (!str) return '';
        return str
            .replace(/\[Current Water Height\]/g, '{level}')
            .replace(/\[Alert Color\]/g, '{status}')
            .replace(/\[Time Recorded\]/g, '{timestamp}')
            .replace(/\[Resident Name\]/g, '{name}')
            .replace(/\[OTP Code\]/g, '{otp}')
            .replace(/\[Manual Message\]/g, '{message}');
    };

    const [searchTerm, setSearchTerm] = useState('');
    // Admin Users State
    const [adminUsers, setAdminUsers] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);
    const [datasetRequests, setDatasetRequests] = useState([]);
    // User Modal States
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ fullName: '', username: '', password: '', role: 'ADMIN' });

    // New Features State
    const [demoMode, setDemoMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [trendIndicators, setTrendIndicators] = useState({ waterLevel: '-', flowRate: '-' });
    const prevReadings = useRef({ waterLevel: null, flowRate: null });
    const [lastMqttAt, setLastMqttAt] = useState(null);
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(null);
    const [evacuationSites, setEvacuationSites] = useState([]);
    const evacuationSitesRef = useRef([]);

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
            else newDash.statusColor = 'text-slate-400';

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
            const safe = Array.isArray(data) ? data : [];
            const order = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'OTP', 'MANUAL'];
            safe.sort((a, b) => {
                const ai = order.indexOf(String(a?.alertType || '').toUpperCase());
                const bi = order.indexOf(String(b?.alertType || '').toUpperCase());
                const ax = ai === -1 ? 999 : ai;
                const bx = bi === -1 ? 999 : bi;
                if (ax !== bx) return ax - bx;
                return String(a?.alertType || '').localeCompare(String(b?.alertType || ''));
            });
            setTemplates(safe);
            // initialize drafts
            setTemplateDrafts(prev => {
                const next = { ...prev };
                safe.forEach(t => {
                    const key = String(t.alertType || '').toUpperCase();
                    if (next[key] === undefined) next[key] = t.template || '';
                });
                return next;
            });
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

    const loadSystemLogsSafe = async () => {
        try {
            const logs = await fetchSystemLogs();
            setSystemLogs(logs);
        } catch (e) {
            // Some roles/backends may not allow logs; fail silently for dashboard widget.
        }
    };

    const loadEvacuationSites = async () => {
        try {
            const sites = await fetchEvacuationSites();
            const safe = Array.isArray(sites) ? sites : [];
            evacuationSitesRef.current = safe;
            setEvacuationSites(safe);
        } catch (e) {
            evacuationSitesRef.current = [];
            setEvacuationSites([]);
        }
    };

    const loadDatasetRequests = async () => {
        try {
            const reqs = await fetchPendingDatasetRequests();
            setDatasetRequests(reqs);
        } catch (e) { console.error(e); }
    };

    // -------------------------------------------------------------
    // EFFECTS
    // -------------------------------------------------------------
    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;
        if (demoMode) return;
        
        if (mqttData) {
            setLastMqttAt(Date.now());
            const newDash = { ...dashData };
            newDash.waterLevel = (mqttData.waterLevelM !== null && mqttData.waterLevelM !== undefined) ? mqttData.waterLevelM.toFixed(2) + ' m' : '--';
            newDash.flowRate = (mqttData.sensorFlowRateMps !== null) ? mqttData.sensorFlowRateMps.toFixed(2) + ' m/s' : '-- m/s';
            
            const level = mqttData.currentAlertLevel || 'OFFLINE';
            newDash.status = level;
            if (level === 'RED') newDash.statusColor = 'text-red-600';
            else if (level === 'ORANGE') newDash.statusColor = 'text-orange-500';
            else if (level === 'YELLOW') newDash.statusColor = 'text-yellow-500';
            else if (level === 'GREEN') newDash.statusColor = 'text-green-600';
            else newDash.statusColor = 'text-slate-400';

            if (mqttData.predictedLevel !== null && mqttData.predictedLevel !== undefined) {
                newDash.prediction = mqttData.predictedLevel.toFixed(2) + ' m';
            }

            setDashData(newDash);

            if (mqttData.snapshotBase64 && mqttData.snapshotBase64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${mqttData.snapshotBase64}`);
            }
            // Trend Indicator calculations
            if (prevReadings.current.waterLevel !== null && mqttData.waterLevelM !== null) {
                if (mqttData.waterLevelM > prevReadings.current.waterLevel + 0.05) setTrendIndicators(prev => ({...prev, waterLevel: '↑'}));
                else if (mqttData.waterLevelM < prevReadings.current.waterLevel - 0.05) setTrendIndicators(prev => ({...prev, waterLevel: '↓'}));
                else setTrendIndicators(prev => ({...prev, waterLevel: '-'}));
            }
            if (prevReadings.current.flowRate !== null && mqttData.sensorFlowRateMps !== null) {
                if (mqttData.sensorFlowRateMps > prevReadings.current.flowRate + 0.05) setTrendIndicators(prev => ({...prev, flowRate: '↑'}));
                else if (mqttData.sensorFlowRateMps < prevReadings.current.flowRate - 0.05) setTrendIndicators(prev => ({...prev, flowRate: '↓'}));
                else setTrendIndicators(prev => ({...prev, flowRate: '-'}));
            }
            prevReadings.current.waterLevel = mqttData.waterLevelM;
            prevReadings.current.flowRate = mqttData.sensorFlowRateMps;

            loadChartData(telemetryTime);
        }
    }, [mqttData, demoMode]);

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;

        loadDashboardData();
        loadCameraFeed();
        loadTideData();
        loadChartData(telemetryTime);
        loadResidents();
        loadTemplates();
        loadEvacuationSites();
        loadSystemLogsSafe();
        loadDatasetRequests();

        if (isHeadAdmin) {
            loadAdminUsersData();
        }

        const tideInterval = setInterval(loadTideData, 3600000);
        const logsInterval = setInterval(loadSystemLogsSafe, 45000);

        return () => {
            clearInterval(tideInterval);
            clearInterval(logsInterval);
        };
    }, []);
    
    // Telemetry time changer
    useEffect(() => {
        if (user && !demoMode) loadChartData(telemetryTime);
    }, [telemetryTime]);

    // Demo Mode logic
    useEffect(() => {
        let interval;
        if (demoMode) {
            setLastMqttAt(Date.now());
            interval = setInterval(() => {
                const randomFlow = Math.random() * (1.5 - 0.5) + 0.5;
                const prevWl = prevReadings.current.waterLevel || 5.5;
                const drift = (Math.random() - 0.35) * 0.08; // slightly biased upward for demos
                const newWl = Math.max(4.0, Math.min(10.0, prevWl + (randomFlow * 0.08) + drift));
                
                setDashData(prev => ({
                    ...prev,
                    waterLevel: newWl.toFixed(2) + ' m',
                    flowRate: randomFlow.toFixed(2) + ' m/s',
                    status: newWl >= 8.5 ? 'RED' : newWl >= 7.0 ? 'ORANGE' : newWl >= 6.0 ? 'YELLOW' : 'GREEN',
                    statusColor: newWl >= 8.5 ? 'text-red-600' : newWl >= 7.0 ? 'text-orange-500' : newWl >= 6.0 ? 'text-yellow-500' : 'text-green-600',
                    prediction: (newWl + 0.5).toFixed(2) + ' m'
                }));

                setTrendIndicators(prev => ({
                    waterLevel: newWl > prevWl ? '↑' : newWl < prevWl ? '↓' : '-',
                    flowRate: randomFlow > (prevReadings.current.flowRate ?? randomFlow) ? '↑' : '↓'
                }));

                prevReadings.current.waterLevel = newWl;
                prevReadings.current.flowRate = randomFlow;
                setLastMqttAt(Date.now());

                // Mock "real-time" chart flow by appending to the series.
                const ts = new Date().toISOString();
                const imageFlow = Math.max(0, randomFlow - 0.15 + (Math.random() * 0.2));
                const predicted = Math.min(25, newWl + (0.2 + Math.random() * 0.6));
                setRawSensorData(prev => {
                    const next = [
                        ...(Array.isArray(prev) ? prev : []).slice(-89),
                        {
                            timestamp: ts,
                            waterLevelM: newWl,
                            sensorFlowRateMps: randomFlow,
                            imageFlowRateMps: imageFlow,
                            predictedLevel: predicted
                        }
                    ];
                    return next;
                });
            }, 3000);
        } else if (user) {
            loadDashboardData();
        }
        return () => clearInterval(interval);
    }, [demoMode]);

    // "Last updated" ticker
    useEffect(() => {
        if (!lastMqttAt) {
            setSecondsSinceUpdate(null);
            return;
        }
        const t = setInterval(() => {
            setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - lastMqttAt) / 1000)));
        }, 1000);
        return () => clearInterval(t);
    }, [lastMqttAt]);

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

        if(!window.confirm(`Are you sure you want to broadcast a ${level} alert?`)) return;

        try {
            const actor = `${displayName}${user?.id ? ` (${user.id})` : ''}`;
            const safeReason = `${reason || 'Admin Manual Action'} [override by ${actor}]`;
            await overrideAlert(level, safeReason);
            alert(`Alert level forcefully overridden to ${level}`);
            loadDashboardData();
            if(isHeadAdmin) loadAdminUsersData(); // Reload logs
        } catch(e) {
            alert('Error overriding alert.');
        }
    };

    const generateCSVReport = ({ telemetryData, startDate, endDate, includeTelemetry, includeAI }) => {
        const safeData = Array.isArray(telemetryData) ? telemetryData : [];
        const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
        const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
        const filtered = safeData.filter(d => {
            const ts = d?.timestamp ? new Date(d.timestamp) : null;
            if (!ts || Number.isNaN(ts.getTime())) return false;
            if (start && ts < start) return false;
            if (end && ts > end) return false;
            return true;
        });

        const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
        const wl = filtered.map(d => toNum(d.waterLevelM)).filter(v => typeof v === 'number' && !Number.isNaN(v));
        const fr = filtered.map(d => toNum(d.sensorFlowRateMps)).filter(v => typeof v === 'number' && !Number.isNaN(v));

        const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
        const min = (arr) => (arr.length ? Math.min(...arr) : null);
        const max = (arr) => (arr.length ? Math.max(...arr) : null);

        const summaryRows = [
            ['Metric', 'Value'],
            ['Generated At', new Date().toLocaleString()],
            ['Generated By', displayName],
            ['Date Range', `${startDate || '—'} to ${endDate || '—'}`],
            ['Rows Exported', String(filtered.length)],
            [''],
            ['Telemetry Summary', ''],
            ['Water Level (m) - Min', wl.length ? min(wl).toFixed(2) : '—'],
            ['Water Level (m) - Avg', wl.length ? avg(wl).toFixed(2) : '—'],
            ['Water Level (m) - Max', wl.length ? max(wl).toFixed(2) : '—'],
            ['Flow Rate (m/s) - Min', fr.length ? min(fr).toFixed(2) : '—'],
            ['Flow Rate (m/s) - Avg', fr.length ? avg(fr).toFixed(2) : '—'],
            ['Flow Rate (m/s) - Max', fr.length ? max(fr).toFixed(2) : '—'],
        ];

        const dataRows = filtered.map(d => {
            const row = { 'Timestamp': new Date(d.timestamp).toLocaleString() };
            if (includeTelemetry) {
                row['Water Level (m)'] = d.waterLevelM ?? '';
                row['Flow Rate (m/s)'] = d.sensorFlowRateMps ?? '';
                row['Optical Flow (m/s)'] = d.imageFlowRateMps ?? '';
            }
            if (includeAI) {
                row['ML Predicted Level (m)'] = d.predictedLevel ?? '';
            }
            return row;
        });

        const titleBlock = Papa.unparse([['SurgeAlert Report'], ['']]);
        const summaryBlock = Papa.unparse(summaryRows, { quotes: true });
        const dataHeader = Papa.unparse([[''], ['Data']], { quotes: true });
        const dataBlock = Papa.unparse(dataRows, { quotes: true });
        return `${titleBlock}\n${summaryBlock}\n${dataHeader}\n${dataBlock}\n`;
    };

    const handleDownloadReport = async (format) => {
        try {
            if (format === 'csv') {
                const telemetryData = await fetchSensorData(24 * 7); // Export 7 days
                const csvStr = generateCSVReport({
                    telemetryData,
                    startDate: reportStart,
                    endDate: reportEnd,
                    includeTelemetry: reportTelemetry,
                    includeAI: reportAI
                });
                const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SurgeAlert_Report_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                if(isHeadAdmin) loadAdminUsersData();
            } else {
                alert("PDF rendering requires external library setup. Try CSV.");
            }
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

    const handleAddManualResident = async (e) => {
        e.preventDefault();
        try {
            await registerResident({ 
                fullName: newResidentState.name, 
                phoneNumber: newResidentState.phone 
            });
            setIsAddingResident(false);
            setNewResidentState({ name: '', phone: '' });
            loadResidents();
            loadDashboardData();
            alert('Resident manually added successfully.');
        } catch(e) {
            alert('Error adding resident: ' + e.message);
        }
    };

    const handleSaveTemplate = async (type, template) => {
        try {
            await saveTemplateAPI(type, template);
            // Keep UI state consistent without reloading entire page
            setTemplates(prev => prev.map(t => (String(t.alertType).toUpperCase() === String(type).toUpperCase() ? { ...t, template } : t)));
            alert(`${type} Template updated!`);
        } catch (e) { alert("Failed update."); }
    };

    const beginEditTemplate = (type, currentText) => {
        const key = String(type || '').toUpperCase();
        setEditingTemplateType(key);
        setTemplateDrafts(prev => ({ ...prev, [key]: backendToUI(currentText ?? prev[key] ?? '') }));
    };

    const cancelEditTemplate = () => {
        setEditingTemplateType(null);
    };

    const saveEditedTemplate = async (type) => {
        const key = String(type || '').toUpperCase();
        const next = templateDrafts[key] ?? '';
        let normalized = uiToBackend(String(next));
        
        // Ensure no legacy placeholders are left
        if (key === 'OTP') {
            normalized = normalized.replaceAll('[%s]', '{otp}').replaceAll('%s', '{otp}');
        } else if (key === 'MANUAL') {
            normalized = normalized.replaceAll('[%s]', '{timestamp}');
        } else {
            normalized = normalized.replaceAll('[%s]', '{timestamp}').replaceAll('%s', '{timestamp}');
        }
        normalized = normalized.replaceAll('{waterLevel}', '{level}');
        
        await handleSaveTemplate(key, normalized);
        setEditingTemplateType(null);
    };

    const handleLogout = () => {
        clearUser();
        window.location.href = '/';
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
        plugins: {
            ...commonChartOptions.plugins,
            annotation: {
                annotations: {
                    box1: { type: 'box', yMin: 0, yMax: 15, backgroundColor: 'rgba(74, 222, 128, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                    box2: { type: 'box', yMin: 15, yMax: 16, backgroundColor: 'rgba(250, 204, 21, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                    box3: { type: 'box', yMin: 16, yMax: 18, backgroundColor: 'rgba(251, 146, 60, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                    box4: { type: 'box', yMin: 18, yMax: 25, backgroundColor: 'rgba(248, 113, 113, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                }
            }
        },
        scales: {
            ...commonChartOptions.scales,
            y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Level (m)'} },
            y1: { type: 'linear', display: true, position: 'right', title: {display: true, text: 'Flow (m/s)'}, grid: { drawOnChartArea: false } },
        }
    };

    const getETRText = () => {
        const flowStr = String(dashData.flowRate).replace(/[^0-9.-]/g, '');
        const levelStr = String(dashData.waterLevel).replace(/[^0-9.-]/g, '');
        const flow = parseFloat(flowStr);
        const level = parseFloat(levelStr);
        if (isNaN(flow) || isNaN(level)) return 'Calculating...';
        if (flow <= 0) return 'Stable (No increase)';
        if (level >= 18) return 'Critical level reached';
        // UI-side extrapolation: we assume a rough mapping from flow rate (m/s) to
        // water level rise rate (m/hour). This keeps the dashboard useful even
        // without a backend-derived rise-rate model.
        const riseRateMph = Math.max(0.02, flow * 0.22);
        const hours = (18 - level) / riseRateMph;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `Red Alert expected in ${h}h ${m}m`;
    };

    const getWaterLevelContext = () => {
        const levelStr = String(dashData.waterLevel).replace(/[^0-9.-]/g, '');
        const level = parseFloat(levelStr);
        if (Number.isNaN(level)) return '—';
        if (level < 15) return 'Normal Flow';
        if (level < 16) return 'Caution Zone';
        if (level < 18) return 'Prepare Zone';
        return 'Danger Zone';
    };

    const getFlowContext = () => {
        const flowStr = String(dashData.flowRate).replace(/[^0-9.-]/g, '');
        const flow = parseFloat(flowStr);
        if (Number.isNaN(flow)) return '—';
        if (flow < 0.6) return 'Low Flow';
        if (flow < 1.1) return 'Normal Flow';
        return 'Fast Flow';
    };

    const latestLogs = [...(Array.isArray(systemLogs) ? systemLogs : [])]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

    const hardwareOnline = demoMode ? true : (secondsSinceUpdate !== null ? secondsSinceUpdate <= 12 : false);

    const filteredResidents = (Array.isArray(residents) ? residents : []).filter(r => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        const name = String(r?.fullName || '').toLowerCase();
        const phone = String(r?.phoneNumber || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
    });

    // -------------------------------------------------------------
    // RENDER HELPERS
    // -------------------------------------------------------------
    const navItems = [
        { key: 'dashboard', label: 'System Dashboard', icon: 'fa-gauge' },
        { key: 'telemetry', label: 'Historical Data', icon: 'fa-chart-line' },
        { key: 'ai', label: 'AI Forecast & Tides', icon: 'fa-brain' },
        { key: 'residents', label: 'Subscribers List', icon: 'fa-users' },
        { key: 'templates', label: 'Message Templates', icon: 'fa-comment-sms' },
        { key: 'datasets', label: 'Data Requests', icon: 'fa-database' },
        { key: 'reports', label: 'Download Reports', icon: 'fa-file-export' },
    ];
    if (isHeadAdmin) navItems.push({ key: 'admin_users', label: 'User Management', icon: 'fa-user-shield' });

    if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return null;

    return (
        <div className="flex h-screen overflow-hidden bg-[#0f172a]">
            {/* SIDEBAR */}
            <aside className={`${isSidebarOpen ? 'w-68' : 'w-20'} bg-[#0f172a] text-white flex flex-col shadow-xl transition-all duration-300 relative`} id="sidebar">
                {/* Demo Mode Toggle */}
                <div className="absolute top-2 right-[-40px] z-50">
                    <button onClick={() => setDemoMode(!demoMode)} className={`p-2 rounded-r-lg shadow-md ${demoMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-600 hover:bg-gray-400'} transition tooltip-parent`}>
                        <i className={`fa-solid ${demoMode ? 'fa-vial-circle-check text-white' : 'fa-vial text-slate-200'}`}></i>
                        <span className="tooltip-text whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded absolute top-full left-0 mt-1 pointer-events-none">Demo Mode</span>
                    </button>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-r-lg shadow-md bg-blue-600 hover:bg-blue-700 text-white mt-1 transition">
                        <i className={`fa-solid ${isSidebarOpen ? 'fa-chevron-left' : 'fa-bars'}`}></i>
                    </button>
                </div>

                <div className="p-6 flex items-center justify-center border-b border-gray-700 bg-black bg-opacity-30 h-20 overflow-hidden">
                    <i className="fa-solid fa-water text-2xl mr-3 text-teal-400"></i>
                    <span className={`text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-300 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>SurgeAdmin</span>
                </div>

                <div className={`p-5 border-b border-gray-700 bg-opacity-50 bg-black flex items-center ${isSidebarOpen ? 'space-x-4' : 'justify-center'} overflow-hidden`}>
                    <div className="w-12 h-12 flex-shrink-0 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-xl font-bold shadow-lg">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    {isSidebarOpen && (
                        <div className="transition-opacity duration-200 min-w-[120px]">
                            <p className="text-sm font-bold text-white tracking-wide truncate">{displayName}</p>
                            <p className="text-xs text-teal-300 font-semibold tracking-wider truncate">{role}</p>
                        </div>
                    )}
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
                                    } ${!isSidebarOpen ? 'justify-center' : ''}`}
                                    title={!isSidebarOpen ? item.label : ""}
                                >
                                    <i className={`fa-solid ${item.icon} w-6 text-center text-lg`}></i>
                                    {isSidebarOpen && <span className="ml-3 font-semibold whitespace-nowrap">{item.label}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-5 border-t border-gray-700">
                    <button onClick={handleLogout} className={`w-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl transition font-bold shadow hover:shadow-lg ${!isSidebarOpen ? 'px-0' : ''}`} title="Sign Out">
                        <i className={`fa-solid fa-right-from-bracket ${isSidebarOpen ? 'mr-2' : ''}`}></i> {isSidebarOpen && "Sign Out"}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto relative w-full pt-6 pb-12 px-8">
                
                {/* 1. DASHBOARD */}
                {activeView === 'dashboard' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-8">
                            <h1 className="text-3xl font-black text-sky-100 tracking-tight pl-10">Dashboard</h1>
                            <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${hardwareOnline ? 'bg-green-900/40 border-green-200 text-green-700' : 'bg-[#0f172a] border-slate-700 text-slate-300'}`}>
                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${hardwareOnline ? 'bg-green-500' : 'bg-gray-400'} ${hardwareOnline ? 'animate-pulse' : ''}`}></span>
                                    {demoMode ? 'Demo stream' : 'Live stream'}
                                </span>
                                <span className="hidden sm:inline">
                                    Last updated: {secondsSinceUpdate === null ? '—' : `${secondsSinceUpdate}s ago`}
                                </span>
                            </div>
                        </div>

                        {/* HEAD ADMIN OVERRIDE BANNER */}
                        {isHeadAdmin && (
                            <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-red-900 bg-gradient-to-r from-red-900/60 to-[#1e293b] overflow-hidden mb-8">
                                <div className="bg-red-950 border-b border-red-900 text-red-400 px-6 py-3 font-bold flex items-center">
                                    <i className="fa-solid fa-triangle-exclamation mr-3 animate-pulse text-red-500"></i>
                                    OFFICIAL ALERT OVERRIDE PANEL
                                </div>
                                <div className="p-6 flex flex-col md:flex-row items-center justify-between">
                                    <div className="mb-4 md:mb-0">
                                        <p className="text-sm text-slate-300">Current Logic Status: <span className="font-bold">{dashData.status}</span></p>
                                        <p className="text-sm text-slate-300 flex items-center">
                                            AI Recommended Status: 
                                            <span className={`font-bold ml-1 ${aiRecommendedStatus === 'RED' ? 'text-red-600' : aiRecommendedStatus === 'ORANGE' ? 'text-orange-500' : aiRecommendedStatus === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'}`}>
                                                {aiRecommendedStatus}
                                            </span>
                                            {isDivergent && <i className="fa-solid fa-triangle-exclamation text-yellow-500 ml-2 animate-pulse" title="Divergence Detected!"></i>}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Force the system to broadcast a specific alert level to residents.</p>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleOverride('NORMAL')} className="bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2 px-4 rounded-lg shadow transition">Normal/Auto</button>
                                            <button onClick={() => handleOverride('YELLOW')} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-4 rounded-lg shadow transition">Yellow</button>
                                            <button onClick={() => handleOverride('ORANGE')} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow transition">Orange</button>
                                            <button onClick={() => handleOverride('RED')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow transition">Red</button>
                                        </div>
                                        {aiRecommendedStatus !== 'NORMAL' && (
                                            <button onClick={() => handleOverride(aiRecommendedStatus)} className="text-xs flex items-center bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 border border-blue-800 py-1 px-3 rounded-full font-bold transition">
                                                <i className="fa-solid fa-rotate mr-1"></i> Sync to AI
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TOP CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <DashboardCard title="Water Level" value={dashData.waterLevel} icon="fa-water" color="blue" trend={trendIndicators.waterLevel} subtitle={`${getWaterLevelContext()}`} />
                            <DashboardCard title="Current Flow Speed" value={dashData.flowRate} icon="fa-water-arrow-up" color="indigo" trend={trendIndicators.flowRate} subtitle={`${getFlowContext()}`} />
                            <DashboardCard title="Estimated Time to Danger" value={getETRText()} icon="fa-hourglass-half" color="teal" subtitle="Based on current flow + distance to 18m." />
                            <DashboardCard title="AI Forecast Trajectory (+1h)" value={dashData.prediction} icon="fa-brain" color="purple" subtitle="Where the water level is heading." />
                            <DashboardCard title="Active Warning Subscribers" value={dashData.subscriberCount} icon="fa-users" color="teal" subtitle="Residents currently receiving texts." />
                        </div>

                        {/* HEALTH + MINI-LOG */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                            <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700">
                                <h3 className="text-lg font-bold text-sky-100 mb-4 flex items-center">
                                    <i className="fa-solid fa-heart-pulse mr-2 text-red-500"></i> Hardware Health
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <HealthRow label="Main Controller" ok={hardwareOnline} />
                                    <HealthRow label="GSM Module" ok={hardwareOnline} />
                                    <HealthRow label="Ultrasonic" ok={hardwareOnline} />
                                    <HealthRow label="Radar" ok={hardwareOnline} />
                                </div>
                                <div className="mt-4 text-xs text-slate-400">
                                    {demoMode ? 'Mocked as online for presentations.' : 'Online if receiving telemetry in the last ~12 seconds.'}
                                </div>
                            </div>

                            <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-sky-100 mb-4 flex items-center">
                                    <i className="fa-solid fa-rectangle-list mr-2 text-indigo-600"></i> Mini Log Feed
                                </h3>
                                <div className="flex-1 space-y-3">
                                    {latestLogs.length === 0 ? (
                                        <div className="text-sm text-slate-400 bg-[#0f172a] border border-slate-700 rounded-xl p-4">
                                            No recent system logs yet.
                                        </div>
                                    ) : (
                                        latestLogs.map((log, i) => (
                                            <div key={i} className="flex items-start gap-3 bg-[#0f172a] border border-slate-700 rounded-xl p-3">
                                                <span className="mt-1 inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                                                <div className="flex-1">
                                                    <div className="text-xs font-bold text-slate-400">
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                                                    </div>
                                                    <div className="text-sm font-semibold text-slate-200">
                                                        {log.message || '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-slate-500">Showing latest 5 entries.</div>
                            </div>

                            <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
                                <h3 className="text-lg font-bold text-sky-100 mb-4 flex items-center">
                                    <i className="fa-solid fa-moon mr-2 text-indigo-500"></i> Quick Tides
                                </h3>
                                <div className="flex-1 bg-gradient-to-b from-blue-50 to-indigo-50 rounded-xl p-6 flex flex-col justify-center text-center">
                                    {nextTide ? (
                                        <>
                                            <div className="w-20 h-20 mx-auto bg-[#1e293b] rounded-full flex items-center justify-center shadow-md mb-4 border border-blue-900/50">
                                                <i className={`fa-solid ${nextTide.type === 'High' ? 'fa-arrow-up text-blue-500' : 'fa-arrow-down text-teal-500'} text-3xl`}></i>
                                            </div>
                                            <h4 className="text-lg font-bold text-slate-200">Rising to {nextTide.type} Tide</h4>
                                            <p className="text-3xl font-black text-sky-100 my-2">{new Date(nextTide.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            <p className="text-sm font-semibold text-slate-400">Predicted Height: {nextTide.height.toFixed(2)}m</p>
                                        </>
                                    ) : (
                                        <p className="text-slate-400">Loading tide data...</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* MEDIA CENTER & QUICK TIDES */}
                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
                                <h3 className="text-xl font-bold text-sky-100 mb-4 flex items-center">
                                    <i className="fa-solid fa-camera mr-2 text-blue-500"></i> Media Center (Live Feed)
                                </h3>
                                <div className="bg-black rounded-xl overflow-hidden flex-1 relative min-h-[400px]">
                                    {cameraImg ? (
                                        <img src={cameraImg} alt="Live Feed" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-400 border-2 border-dashed border-gray-700 m-8 rounded-xl">
                                            <div className="text-center">
                                                <i className="fa-solid fa-video-slash text-4xl mb-3"></i>
                                                <p>{demoMode ? 'Demo Mode: Simulated camera feed' : 'Camera feed currently unavailable'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. TELEMETRY & ANALYTICS */}
                {activeView === 'telemetry' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Historical Data</h1>
                        
                        {/* Current Readings */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <TelemetryCard title="Ultrasonic WL" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].waterLevelM?.toFixed(2) + ' m' : '--'} icon="fa-ruler-vertical" color="blue" />
                            <TelemetryCard title="Speed Radar Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].sensorFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-radar" color="purple" />
                            <TelemetryCard title="Optical Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].imageFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-eye" color="teal" />
                        </div>

                        {/* Calculated Rates */}
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-8 mb-8 text-center bg-gradient-to-r from-blue-50 to-indigo-50">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Calculated Rate of Change</p>
                            <h2 className="text-3xl font-black text-sky-100">
                                Water is <span className="text-blue-600">Stable</span>
                            </h2>
                            <p className="text-xs mt-2 text-slate-500">Calculated over the last 15 minutes</p>
                        </div>

                        {/* Historical Graph */}
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-sky-100">Historical Sensor Data</h3>
                                    <div className="relative tooltip-parent">
                                        <i className="fa-solid fa-circle-info text-slate-500"></i>
                                        <span className="tooltip-text whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded absolute top-full left-0 mt-1 pointer-events-none">
                                            Moving Average Filter applied (display note)
                                        </span>
                                    </div>
                                </div>
                                <select 
                                    className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-semibold"
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
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">AI Forecast & Tides</h1>
                        
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
                                <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6">
                                    <h3 className="text-lg font-bold text-sky-100 mb-4 border-b border-slate-700 pb-2 flex items-center">
                                        <i className="fa-solid fa-water list-icon mr-2 text-teal-600"></i> Tide Timeline (24h)
                                    </h3>
                                    <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                        {tides.slice(0, 10).map((t, i) => (
                                            <div key={i} className="flex items-center">
                                                <div className="w-12 text-xs font-bold text-slate-500">{new Date(t.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                <div className="mx-3 flex flex-col items-center">
                                                    <div className={`w-3 h-3 rounded-full ${t.type === 'High' ? 'bg-blue-500' : 'bg-teal-500'} ring-4 ring-gray-50`}></div>
                                                    {i !== 9 && <div className="w-px h-10 bg-slate-700 my-1"></div>}
                                                </div>
                                                <div className="flex-1 bg-[#0f172a] rounded-lg p-2 border border-slate-700">
                                                    <p className="text-sm font-bold text-slate-200">{t.type} Tide</p>
                                                    <p className="text-xs text-slate-400">{t.height.toFixed(2)}m</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* AI Forecast Graph */}
                            <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6 flex flex-col">
                                <h3 className="text-xl font-bold text-sky-100 mb-2">AI Forecast Trajectory</h3>
                                <p className="text-sm text-slate-400 mb-6">Comparing historical sensor data against the AI's projected path for the next hour.</p>
                                <div className="flex-1 w-full relative min-h-[400px]">
                                    <Line data={aiChartData} options={commonChartOptions} />
                                </div>
                                <div className="bg-yellow-900/40 border border-yellow-200 text-yellow-800 text-xs px-4 py-3 rounded-lg mt-4 flex items-center">
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
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Subscribers List</h1>
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex-1 relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name or phone number..."
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-700 bg-[#1e293b] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-slate-200"
                                />
                            </div>
                            <button
                                onClick={() => setSearchTerm("")}
                                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
                                disabled={!searchTerm}
                                title="Clear search"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setIsAddingResident(!isAddingResident)}
                                className="px-4 py-3 rounded-xl bg-green-900/40 border border-green-800 hover:bg-green-900/60 text-green-400 font-bold transition whitespace-nowrap"
                            >
                                <i className="fa-solid fa-user-plus mr-2"></i>Add Resident
                            </button>
                        </div>
                        
                        {isAddingResident && (
                            <div className="bg-[#1e293b] rounded-xl shadow border border-green-800 p-6 mb-4 animate-fade-in">
                                <h3 className="text-lg font-bold text-sky-100 mb-4">Manually Register Resident</h3>
                                <form onSubmit={handleAddManualResident} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Full Name</label>
                                        <input required type="text" className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 text-sm rounded-lg px-4 py-2 focus:border-sky-500 outline-none" value={newResidentState.name} onChange={e => setNewResidentState({...newResidentState, name: e.target.value})} placeholder="Juan Dela Cruz" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Phone Number</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 text-sm font-mono text-slate-400 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg">+63</span>
                                            <input required type="tel" maxLength="10" className="w-full bg-[#0f172a] font-mono border border-slate-700 text-slate-200 text-sm rounded-r-lg px-4 py-2 outline-none focus:border-sky-500" value={newResidentState.phone} onChange={e => setNewResidentState({...newResidentState, phone: e.target.value})} placeholder="9123456789" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition">Submit</button>
                                        <button type="button" onClick={() => setIsAddingResident(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 rounded-lg transition">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="bg-[#1e293b] rounded-2xl shadow-lg overflow-hidden border border-slate-700">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-[#0f172a]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Resident Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-[#1e293b]">
                                    {filteredResidents.map((res, i) => (
                                        <tr key={i} className="hover:bg-[#0f172a] transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-sky-100">{res.fullName || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-300">{res.phoneNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap"><span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-700"><i className="fa-solid fa-check mr-1 mt-0.5"></i> Active</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button className="text-red-500 hover:text-red-700 hover:bg-red-900/40 p-2 rounded-lg transition" onClick={() => handleDeleteResident(res.id, res.fullName)}>Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredResidents.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-10">
                                                <div className="text-center text-slate-400">
                                                    <div className="text-2xl mb-2"><i className="fa-solid fa-users-slash"></i></div>
                                                    <div className="font-bold">No residents match your search.</div>
                                                    <div className="text-sm text-slate-500 mt-1">
                                                        {searchTerm ? `Try a different keyword.` : `No active residents found.`}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 5. TEMPLATES */}
                {activeView === 'templates' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Message Templates</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {templates.map((tpl, i) => (
                                <div key={i} className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 hover:shadow-xl transition relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                        tpl.alertType === 'RED' ? 'bg-red-500' : 
                                        tpl.alertType === 'ORANGE' ? 'bg-orange-500' : 
                                        tpl.alertType === 'YELLOW' ? 'bg-yellow-400' : 
                                        tpl.alertType === 'GREEN' ? 'bg-green-500' : 
                                        tpl.alertType === 'OTP' ? 'bg-purple-500' : 
                                        tpl.alertType === 'MANUAL' ? 'bg-blue-500' : 
                                        'bg-gray-400'}`}></div>
                                    <div className="flex justify-between items-center mb-4 pl-3">
                                        <h3 className="text-xl font-bold text-sky-100 flex items-center">
                                            <i className="fa-solid fa-message mr-2 text-slate-500"></i> {tpl.alertType} ALERT
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {editingTemplateType === String(tpl.alertType).toUpperCase() ? (
                                                <>
                                                    <button
                                                        onClick={() => saveEditedTemplate(tpl.alertType)}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center"
                                                        title="Save"
                                                    >
                                                        <i className="fa-solid fa-floppy-disk mr-2"></i> Save
                                                    </button>
                                                    <button
                                                        onClick={cancelEditTemplate}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 transition flex items-center"
                                                        title="Cancel"
                                                    >
                                                        <i className="fa-solid fa-xmark mr-2"></i> Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => beginEditTemplate(tpl.alertType, tpl.template)}
                                                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center"
                                                    title="Edit template"
                                                >
                                                    <i className="fa-solid fa-pen-to-square mr-2"></i> Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        const typeKey = String(tpl.alertType).toUpperCase();
                                        const draft = templateDrafts[typeKey] ?? (tpl.template || '');
                                        const len = String(draft).length;
                                        const limit = 160;
                                        const perPart = 153; // rough estimate when concatenated
                                        const parts = len <= limit ? 1 : Math.ceil(len / perPart);
                                        const over = len > limit;
                                        const isEditing = editingTemplateType === typeKey;

                                        const legendRows = (() => {
                                            if (typeKey === 'OTP') {
                                                return [
                                                    { k: '{otp}', v: "OTP Code / OTP Code" },
                                                    { k: '{timestamp}', v: "Time / Oras (auto)" },
                                                ];
                                            }
                                            if (typeKey === 'MANUAL') {
                                                return [
                                                    { k: '{message}', v: "Manual message / Mensahe" },
                                                    { k: '{timestamp}', v: "Time / Oras (auto)" },
                                                ];
                                            }
                                            return [
                                                { k: '{name}', v: "Resident’s Name (reserved; broadcast is shared) / Pangalan" },
                                                { k: '{level}', v: "Current Water Height / Taas ng Tubig" },
                                                { k: '{status}', v: "Alert Color (Yellow/Orange/Red/Green) / Kulay" },
                                                { k: '{timestamp}', v: "Time recorded/sent / Oras (auto)" },
                                            ];
                                        })();

                                        return (
                                            <div className="flex flex-col md:flex-row gap-4 ml-3">
                                                <div className="flex-1">
                                                    <textarea
                                                        rows="5"
                                                        className="w-full border-2 border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 bg-[#0f172a] shadow-inner"
                                                        value={draft}
                                                        onChange={(e) => {
                                                            const key = String(tpl.alertType).toUpperCase();
                                                            setTemplateDrafts(prev => ({ ...prev, [key]: e.target.value }));
                                                        }}
                                                        disabled={!isEditing}
                                                        placeholder="Write your SMS template..."
                                                    ></textarea>

                                                    <div className="mt-2 flex items-center justify-between text-xs">
                                                        <div className={`font-bold ${over ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {len} / {limit} characters
                                                            <span className="ml-2 font-semibold text-slate-500">(~{parts} SMS{parts > 1 ? ' parts' : ''})</span>
                                                        </div>
                                                        <div className="text-slate-500 font-semibold">
                                                            Tip: Put Tagalog first.
                                                        </div>
                                                    </div>
                                                    {isEditing && (
                                                        <div className="mt-3 flex flex-wrap gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                                            <span className="text-xs text-slate-400 font-bold mr-1"><i className="fa-solid fa-wand-magic-sparkles mr-1"></i> Insert Data:</span>
                                                            {legendRows.map((r, idx) => (
                                                                <button key={idx} type="button" onClick={() => {
                                                                    const key = String(tpl.alertType).toUpperCase();
                                                                    setTemplateDrafts(prev => ({ ...prev, [key]: (prev[key] || '') + r.k }));
                                                                }} className="text-[11px] bg-[#0f172a] hover:bg-sky-900/60 text-sky-200 font-bold font-mono px-3 py-1.5 rounded transition shadow-sm border border-slate-600 hover:border-sky-500">
                                                                    + {r.k}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="w-full md:w-72 bg-[#1e293b] border border-slate-700 rounded-xl p-4">
                                                    <div className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3">
                                                        Legend / Cheat Sheet
                                                    </div>
                                                    <div className="space-y-2 text-xs">
                                                        {legendRows.map((r, idx) => (
                                                            <div key={idx} className="flex items-start justify-between gap-3">
                                                                <div className="font-mono font-bold text-sky-100 whitespace-nowrap">{r.k}</div>
                                                                <div className="text-slate-300 font-semibold text-right">{r.v}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                                                        Timestamp is appended automatically on the backend if missing.
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* DATASET REQUESTS */}
                {activeView === 'datasets' && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Data Requests</h1>
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg overflow-hidden border border-slate-700">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-[#0f172a]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Name / Affiliation</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Contact Info</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-[#1e293b]">
                                    {datasetRequests.map((req, i) => (
                                        <tr key={i} className="hover:bg-[#0f172a] transition">
                                            <td className="px-6 py-4 text-sm">
                                                <p className="font-bold text-sky-100">{req.name}</p>
                                                <button onClick={() => alert("Abstract / Purpose:\n\n" + req.abstractPurpose)} className="text-blue-500 text-xs font-bold mt-1 hover:underline">View Purpose</button>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-300">
                                                <div>{req.email}</div>
                                                <div className="text-xs text-slate-500">{req.contactNumber}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-400">
                                                {new Date(req.requestDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button onClick={async () => {
                                                    if(window.confirm('Approve this request? This will mark it as APPROVED.')) {
                                                        try {
                                                            await approveDatasetRequest(req.id);
                                                            loadDatasetRequests();
                                                            alert('Request Approved.');
                                                        } catch(e) { alert('Approval failed'); }
                                                    }
                                                }} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-white transition">
                                                    Approve
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {datasetRequests.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-10">
                                                <div className="text-center text-slate-400">
                                                    <div className="text-2xl mb-2"><i className="fa-solid fa-folder-open"></i></div>
                                                    <div className="font-bold">No pending dataset requests.</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 6. REPORTS */}
                {activeView === 'reports' && (
                    <div className="animate-fade-in max-w-4xl">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Download Reports</h1>
                        
                        <div className="bg-[#1e293b] p-8 rounded-2xl shadow-lg border border-slate-700 flex flex-col md:flex-row gap-8">
                            {/* Form */}
                            <div className="flex-1 space-y-6">
                                <h3 className="text-lg font-bold text-slate-100 border-b pb-2">Filter Parameters</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-200 mb-1">Start Date</label>
                                        <input type="date" value={reportStart} onChange={(e)=>setReportStart(e.target.value)} className="w-full border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition bg-[#0f172a]" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-200 mb-1">End Date</label>
                                        <input type="date" value={reportEnd} onChange={(e)=>setReportEnd(e.target.value)} className="w-full border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition bg-[#0f172a]" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-3">Data to Include</label>
                                    <div className="space-y-3">
                                        <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportTelemetry(!reportTelemetry)}>
                                            <div className={`w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors ${reportTelemetry ? 'bg-blue-500' : 'bg-[#1e293b]'}`}>
                                                {reportTelemetry && <i className="fa-solid fa-check text-white text-xs"></i>}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-600 transition">Sensor Telemetry Data</span>
                                        </label>
                                        <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportAI(!reportAI)}>
                                            <div className={`w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors ${reportAI ? 'bg-blue-500' : 'bg-[#1e293b]'}`}>
                                                {reportAI && <i className="fa-solid fa-check text-white text-xs"></i>}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-600 transition">ML Performance & Predictions</span>
                                        </label>
                                        <label className="flex items-center space-x-3 cursor-not-allowed opacity-50">
                                            <div className="w-5 h-5 border-2 border-slate-600 rounded"></div>
                                            <span className="text-sm font-semibold text-slate-400">SMS Broadcast Logs (Coming soon)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="w-full md:w-64 bg-[#0f172a] p-6 rounded-xl border border-slate-700 flex flex-col justify-center">
                                <h3 className="text-sm font-bold text-center text-slate-400 uppercase tracking-widest mb-6">Export As</h3>
                                <button onClick={() => handleDownloadReport('csv')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition mb-4 flex items-center justify-center">
                                    <i className="fa-solid fa-file-csv text-xl mr-2"></i> Download CSV
                                </button>
                                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-md transition flex items-center justify-center opacity-50 cursor-not-allowed">
                                    <i className="fa-solid fa-file-pdf text-xl mr-2"></i> Download PDF
                                </button>
                                <p className="text-xs text-center text-slate-500 mt-4">PDF rendering requires external library setup.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. ADMIN USERS (HEAD ADMIN ONLY) */}
                {activeView === 'admin_users' && isHeadAdmin && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Admin Accounts</h1>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Accounts Table */}
                            <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
                                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
                                    <h3 className="text-lg font-bold text-sky-100 flex items-center">
                                        <i className="fa-solid fa-shield-halved mr-2 text-indigo-500"></i> Admin Accounts
                                    </h3>
                                    <button onClick={openCreateUserModal} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-bold shadow transition flex items-center">
                                        <i className="fa-solid fa-plus mr-2"></i> Create
                                    </button>
                                </div>
                                <div className="overflow-x-auto p-4">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-slate-700">
                                                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                                                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {adminUsers.map((a, i) => (
                                                <tr key={i} className="hover:bg-[#0f172a]">
                                                    <td className="py-3 px-4">
                                                        <p className="font-bold text-slate-100">{a.fullName}</p>
                                                        <p className="text-xs text-slate-400 font-mono">{a.username}</p>
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
                            <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 flex flex-col max-h-[600px]">
                                <div className="p-6 border-b border-slate-700 bg-[#0f172a]">
                                    <h3 className="text-lg font-bold text-sky-100 flex items-center">
                                        <i className="fa-solid fa-list-check mr-2 text-teal-600"></i> System Action Logs
                                    </h3>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                                    {systemLogs.length === 0 ? (
                                        <div className="text-center text-slate-400 py-8">No recorded actions.</div>
                                    ) : (
                                        systemLogs.map((log, i) => {
                                            const timeStr = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                            const isAlert = log.message.includes('OVERRIDE');
                                            return (
                                                <div key={i} className="flex gap-4">
                                                    <div className="w-16 text-xs font-bold text-slate-500 pt-1 text-right">{timeStr}</div>
                                                    <div className="flex-1 bg-[#0f172a] rounded-lg p-3 text-sm font-medium text-slate-200 border-l-4 border-l-blue-400">
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
                    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in">
                        <div className="bg-[#1e293b] rounded-2xl shadow-2xl p-8 max-w-xl w-full border border-slate-700 ring-4 ring-blue-100/60">
                            <h2 className="text-2xl font-black text-sky-100 mb-6">{editingUser ? 'Edit Account' : 'Create Account'}</h2>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-1">Name:</label>
                                    <input type="text" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full border p-3 rounded-lg bg-[#0f172a] outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Dela Cruz" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-1">Username:</label>
                                    <input type="text" disabled={!!editingUser} value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className={`w-full border p-3 rounded-lg bg-[#0f172a] outline-none focus:ring-2 focus:ring-blue-500 ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="johndoe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-1">Password {editingUser && <span className="text-xs font-normal text-slate-400">(Leave blank to keep current)</span>}:</label>
                                    <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full border p-3 rounded-lg bg-[#0f172a] outline-none focus:ring-2 focus:ring-blue-500" placeholder="***" />
                                </div>
                                
                                <div className="pt-2">
                                    <label className="block text-sm font-bold text-slate-200 mb-3">Role Selector:</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            onClick={() => setUserForm({...userForm, role: 'ADMIN'})}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition ${userForm.role === 'ADMIN' ? 'border-blue-500 bg-blue-900/40' : 'border-slate-700 hover:border-blue-300'}`}
                                        >
                                            <i className="fa-solid fa-user text-2xl text-blue-500 mb-2"></i>
                                            <h4 className="font-bold text-sky-100">Admin</h4>
                                            <p className="text-xs text-slate-400 mt-1">Standard monitoring access.</p>
                                            <ul className="text-[10px] text-slate-500 mt-2 list-disc pl-3">
                                                <li>View Dashboard</li>
                                                <li>View Telemetry</li>
                                                <li>Manage Alerts (Auto)</li>
                                            </ul>
                                        </div>
                                        <div 
                                            onClick={() => setUserForm({...userForm, role: 'HEAD_ADMIN'})}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition ${userForm.role === 'HEAD_ADMIN' ? 'border-red-500 bg-red-900/40' : 'border-slate-700 hover:border-red-300'}`}
                                        >
                                            <i className="fa-solid fa-user-shield text-2xl text-red-500 mb-2"></i>
                                            <h4 className="font-bold text-sky-100">Head Admin</h4>
                                            <p className="text-xs text-slate-400 mt-1">Full system & override control.</p>
                                            <ul className="text-[10px] text-slate-500 mt-2 list-disc pl-3">
                                                <li>Manual overrides</li>
                                                <li>Account Management</li>
                                                <li>System logs access</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                                <button onClick={() => setShowUserModal(false)} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100 font-bold transition">Cancel</button>
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
function DashboardCard({ title, value, icon, color, subtitle, trend }) {
    const colorClasses = {
        blue: "text-[#38bdf8] bg-sky-900/20 shadow-[0_0_15px_rgba(14,165,233,0.3)] border-sky-500",
        indigo: "text-indigo-400 bg-indigo-900/20 shadow-[0_0_15px_rgba(99,102,241,0.3)] border-indigo-500",
        purple: "text-purple-400 bg-purple-900/20 shadow-[0_0_15px_rgba(168,85,247,0.3)] border-purple-500",
        teal: "text-[#2dd4bf] bg-teal-900/20 shadow-[0_0_15px_rgba(20,184,166,0.3)] border-teal-500"
    };
    const mapped = colorClasses[color] || colorClasses.blue;
    const parts = mapped.split(' ');
    const textColor = parts[0];
    const bgColor = parts[1];
    const shadowColor = parts[2];
    const borderColor = parts[3];

    return (
        <div className={`bg-[#1e293b] p-6 rounded-2xl border ${borderColor} ${shadowColor} flex flex-col justify-between overflow-hidden group hover:-translate-y-1 transition duration-300`}>
            <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-tight w-2/3">{title}</p>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border ${borderColor} ${bgColor} ${textColor} flex-shrink-0`}>
                    <i className={`fa-solid ${icon} drop-shadow-md`}></i>
                </div>
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <h3 className={`text-4xl sm:text-5xl font-black tracking-tighter truncate ${textColor}`}>{value}</h3>
                    {trend && trend !== '-' && (
                        <span className={`text-xl font-black ${trend === '↑' ? 'text-green-500' : 'text-green-500'}`} title="Trend vs previous tick">
                            {trend}
                        </span>
                    )}
                    {trend === '-' && (
                        <span className="text-sm font-bold text-slate-500" title="No significant change">—</span>
                    )}
                </div>
                {subtitle && <p className="text-sm text-gray-300 mt-4 font-semibold bg-black/30 p-2 rounded border-l-2 border-slate-600">{subtitle}</p>}
            </div>
        </div>
    );
}

function HealthRow({ label, ok }) {
    return (
        <div className={`flex items-center justify-between border-l-2 pl-4 p-3 rounded-lg ${ok ? 'border-green-500 bg-green-900/10' : 'border-red-500 bg-red-900/10'}`}>
            <div className={`font-bold text-base tracking-wider ${ok ? 'text-gray-200' : 'text-red-400'}`}>{label}</div>
            <div className={`flex items-center gap-2 bg-black/30 px-3 py-1 rounded border border-gray-700`}>
                <span className={`inline-block w-3 h-3 rounded-full ${ok ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></span>
                <span className={`text-sm font-bold uppercase tracking-widest ${ok ? 'text-green-500' : 'text-red-500'}`}>{ok ? 'Secure' : 'Offline'}</span>
            </div>
        </div>
    );
}

function TelemetryCard({ title, value, icon, color }) {
    return (
        <div className={`bg-[#1e293b] p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-gray-700 flex items-center`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mr-5 border-2 bg-gray-900 border-${color}-400 text-${color}-400`}>
                <i className={`fa-solid ${icon} text-2xl`}></i>
            </div>
            <div>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">{title}</p>
                <div className="text-3xl font-black text-sky-100">{value}</div>
            </div>
        </div>
    );
}
