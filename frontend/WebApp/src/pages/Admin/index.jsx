import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend } from 'chart.js';
import { getUser, clearUser } from '../../services/auth.js';
import {
    fetchAlertStatus, fetchCameraFeed as fetchCameraAPI, fetchTidesData,
    fetchActiveResidents, deleteResident as deleteResidentAPI,
    fetchTemplates as fetchTemplatesAPI, saveTemplate as saveTemplateAPI,
    fetchSensorData, overrideAlert, downloadReport,
    fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, fetchSystemLogs, fetchEvacuationSites,
    fetchAllDatasetRequests, updateDatasetRequestStatus, registerResident
} from '../../services/api.js';
import { useSensorMqtt } from '../../hooks/useSensorMqtt.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend, annotationPlugin);

import DashboardCard from './components/DashboardCard';
import HealthRow from './components/HealthRow';
import TelemetryCard from './components/TelemetryCard';
import DashboardView from './views/DashboardView';
import TelemetryView from './views/TelemetryView';
import AIView from './views/AIView';
import ResidentsView from './views/ResidentsView';
import TemplatesView from './views/TemplatesView';
import DatasetsView from './views/DatasetsView';
import ReportsView from './views/ReportsView';
import AdminUsersView from './views/AdminUsersView';

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
    const [reportSms, setReportSms] = useState(false);
    const [reportSubscribers, setReportSubscribers] = useState(false);
    
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
            const reqs = await fetchAllDatasetRequests();
            setDatasetRequests(reqs);
        } catch (e) { console.error(e); }
    };

    const handleUpdateDatasetStatus = async (id, status) => {
        try {
            await updateDatasetRequestStatus(id, status);
            loadDatasetRequests();
        } catch (e) {
            alert('Failed to update request status: ' + e.message);
        }
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

    const handleDownloadReport = async (format) => {
        if (format !== 'xlsx') return;
        try {
            const telemetryData = await fetchSensorData(24 * 7); // Export 7 days
            const safeData = Array.isArray(telemetryData) ? telemetryData : [];
            const start = reportStart ? new Date(`${reportStart}T00:00:00`) : null;
            const end = reportEnd ? new Date(`${reportEnd}T23:59:59`) : null;
            const filtered = safeData.filter(d => {
                const ts = d?.timestamp ? new Date(d.timestamp) : null;
                if (!ts || Number.isNaN(ts.getTime())) return false;
                if (start && ts < start) return false;
                if (end && ts > end) return false;
                return true;
            });

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('SurgeAlert Report');

            ws.addRow(['SurgeAlert Official Data Report']);
            ws.getRow(1).font = { size: 16, bold: true, color: { argb: 'FF004B87' } };
            ws.addRow([]);

            ws.addRow(['Metric', 'Value']).font = { bold: true };
            ws.addRow(['Generated At', new Date().toLocaleString()]);
            ws.addRow(['Generated By', displayName]);
            ws.addRow(['Date Range', `${reportStart || '—'} to ${reportEnd || '—'}`]);
            ws.addRow(['Rows Exported', String(filtered.length)]);
            ws.addRow([]);

            ws.addRow(['Data Export']).font = { size: 14, bold: true };
            
            const columns = [{ header: 'Timestamp', key: 'ts', width: 25 }];
            if (reportTelemetry) {
                columns.push({ header: 'Water Level (m)', key: 'wl', width: 18 });
                columns.push({ header: 'Flow Rate (m/s)', key: 'fr', width: 18 });
            }
            if (reportAI) {
                columns.push({ header: 'ML Predicted Level (m)', key: 'ai', width: 22 });
            }
            ws.columns = columns;

            const headerRow = ws.getRow(ws.rowCount);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            });

            filtered.forEach(d => {
                const rowObj = { ts: new Date(d.timestamp).toLocaleString() };
                if (reportTelemetry) {
                    rowObj.wl = d.waterLevelM;
                    rowObj.fr = d.sensorFlowRateMps;
                }
                if (reportAI) {
                    rowObj.ai = d.predictedLevel;
                }
                ws.addRow(rowObj);
            });

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `SurgeAlert_Report_${new Date().toISOString().slice(0,10)}.xlsx`);

            if(isHeadAdmin) loadAdminUsersData();
        } catch (e) {
            console.error(e);
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
{(() => { const viewProps = { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, 
    openCreateUserModal, openEditUserModal, saveUserModal, 
    beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
    handleDeleteAdminUser,
    handleUpdateDatasetStatus, tides }; return (<>

                
                {/* 1. DASHBOARD */}
{activeView === 'dashboard' && <DashboardView {...viewProps} />}
{/* 2. TELEMETRY & ANALYTICS */}
{activeView === 'telemetry' && <TelemetryView {...viewProps} />}
{/* 3. AI PREDICTIONS & TIDES */}
{activeView === 'ai' && <AIView {...viewProps} />}
{/* 4. RESIDENTS */}
{activeView === 'residents' && <ResidentsView {...viewProps} />}
{/* 5. TEMPLATES */}
{activeView === 'templates' && <TemplatesView {...viewProps} />}
{/* DATASET REQUESTS */}
{activeView === 'datasets' && <DatasetsView {...viewProps} />}
{/* 6. REPORTS */}
{activeView === 'reports' && <ReportsView {...viewProps} />}
{/* 7. ADMIN USERS (HEAD ADMIN ONLY) */}
{activeView === 'admin_users' && <AdminUsersView {...viewProps} />}
</>
                );
                })()}
            </main>
        </div>
    );
}

