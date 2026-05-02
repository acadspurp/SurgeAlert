import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend, TimeScale, TimeSeriesScale } from 'chart.js';
import { getUser, clearUser } from '../../services/auth.js';
import {
    fetchAlertStatus, fetchCameraFeed as fetchCameraAPI, fetchTidesData,
    fetchPendingCriticalAlerts, approvePendingCriticalAlert, rejectPendingCriticalAlert,
    fetchCanaryHealth, advanceCanaryPhase, rollbackCanaryPhase,
    fetchActiveResidents, deleteResident as deleteResidentAPI,
    fetchTemplates as fetchTemplatesAPI, saveTemplate as saveTemplateAPI,
    fetchSensorData, overrideAlert, downloadReport,
    fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, fetchSystemLogs, fetchEvacuationSites,
    fetchAllDatasetRequests, updateDatasetRequestStatus, registerResident, updateCanaryConfig,
    toggleResidentPriority
} from '../../services/api.js';
import { useSensorMqtt } from '../../hooks/useSensorMqtt.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logoUrl } from '../../branding/logo.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend, TimeScale, TimeSeriesScale, annotationPlugin);

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
import CanaryView from './views/CanaryView';

export default function Admin() {
    const navigate = useNavigate();
    const mqttData = useSensorMqtt();

    // Auth Guard
    const user = getUser();
    const role = user && user.role ? String(user.role).toUpperCase().trim() : "";
    const isHeadAdmin = role === 'HEAD_ADMIN';

    useEffect(() => {
        console.log("Admin Guard - User:", user);
        console.log("Admin Guard - Role:", role);

        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) {
            console.warn("Unauthorized access detected. Role found:", role, "Redirecting to login...");
            // Only alert if we actually have a user but wrong role
            if (user) alert("Access Denied. Your account does not have Admin privileges.");
            navigate('/login');
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
    const [cameraLastUpdated, setCameraLastUpdated] = useState(null);
    const [tides, setTides] = useState([]);
    const [nextTide, setNextTide] = useState(null);

    // Telemetry State
    const [telemetryTime, setTelemetryTime] = useState(24);
    const [cvTime, setCvTime] = useState(24);
    const [aiTime, setAiTime] = useState(24);
    const [rawSensorData, setRawSensorData] = useState([]);
    const [cvSensorData, setCvSensorData] = useState([]);

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
    const [newResidentState, setNewResidentState] = useState({ name: '', phone: '', isPriority: false });
    const [templates, setTemplates] = useState([]);
    const [editingTemplateType, setEditingTemplateType] = useState(null);
    const [templateDrafts, setTemplateDrafts] = useState({});

    // Formatters for user-friendly SMS templates
    const backendToUI = (str) => {
        if (!str) return '';
        let s = String(str);
        s = s.replaceAll('{level}', '[Current Water Height]');
        s = s.replaceAll('{waterLevel}', '[Current Water Height]');
        s = s.replaceAll('{status}', '[Alert Color]');
        s = s.replaceAll('{timestamp}', '[Time]');
        s = s.replaceAll('{name}', '[Resident Name]');
        s = s.replaceAll('{otp}', '[OTP Code]');
        s = s.replaceAll('{code}', '[OTP Code]');
        s = s.replaceAll('{message}', '[Manual Message]');
        // LEGACY MIGRATION
        s = s.replaceAll('[%s]', '[Time]');
        s = s.replaceAll('%s', '[Time]');
        return s;
    };

    const uiToBackend = (str) => {
        if (!str) return '';
        let s = String(str);
        s = s.replaceAll('[Current Water Height]', '{level}');
        s = s.replaceAll('[Alert Color]', '{status}');
        s = s.replaceAll('[Time]', '[%s]');
        s = s.replaceAll('[Resident Name]', '{name}');
        s = s.replaceAll('[OTP Code]', '{otp}');
        s = s.replaceAll('[Manual Message]', '{message}');
        return s;
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
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [trendIndicators, setTrendIndicators] = useState({ waterLevel: '-', flowRate: '-' });
    const prevReadings = useRef({ waterLevel: null, flowRate: null });
    const [lastMqttAt, setLastMqttAt] = useState(null);
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(null);
    const [evacuationSites, setEvacuationSites] = useState([]);
    const [pendingCriticalAlerts, setPendingCriticalAlerts] = useState([]);
    const [canaryState, setCanaryState] = useState(null);
    const evacuationSitesRef = useRef([]);

    // Derived State for Hardware Health (Must be before useEffects that use it)
    const hardwareOnline = demoMode ? true : (secondsSinceUpdate !== null ? secondsSinceUpdate <= 12 : false);

    const displayName = (user && (user.fullName || user.username)) || 'Admin';

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
            if (data.img_base64 && data.img_base64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${data.img_base64}`);
                setCameraLastUpdated(new Date().toLocaleTimeString());
            }
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

    const loadChartData = async (hours, type = 'TELEMETRY') => {
        try {
            const data = await fetchSensorData(hours);
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (type === 'TELEMETRY') {
                setRawSensorData(data);
                if (data.length > 0) {
                    const latest = data[data.length - 1];
                    setDashData(prev => ({
                        ...prev,
                        flowRate: latest.sensorFlowRateMps !== null ? latest.sensorFlowRateMps.toFixed(2) + ' m/s' : '-- m/s',
                        prediction: latest.predictedLevel !== null ? latest.predictedLevel.toFixed(2) + ' m' : '-- m',
                    }));
                }
            } else if (type === 'CV') {
                setCvSensorData(data);
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

    const loadPendingCriticalAlerts = async () => {
        try {
            const alerts = await fetchPendingCriticalAlerts();
            setPendingCriticalAlerts(Array.isArray(alerts) ? alerts : []);
        } catch {
            setPendingCriticalAlerts([]);
        }
    };

    const loadCanaryHealth = async () => {
        try {
            const state = await fetchCanaryHealth();
            setCanaryState(state);
        } catch {
            setCanaryState(null);
        }
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

        // Handle Offline State: If hardware is disconnected and demo mode is off, reset values to --
        if (!demoMode && !hardwareOnline) {
            setDashData(prev => ({
                ...prev,
                waterLevel: '-- m',
                flowRate: '-- m/s',
                status: 'OFFLINE',
                statusColor: 'text-slate-400',
                prediction: '-- m'
            }));
            return;
        }

        // Demo mode: ignore live MQTT/API telemetry until the user turns demo off.
        // (We intentionally do NOT auto-disable demo when live data exists — that caused UI
        // toggle glitching and prevented presentations while the backend still returned readings.)

        if (demoMode) return;

        if (mqttData) {
            setLastMqttAt(Date.now());
            const newDash = { ...dashData };
            // Apply noise filter (anything below 0.30m is ghost data)
            const floatWl = mqttData.waterLevelM;
            const isGhost = floatWl !== null && floatWl !== undefined && floatWl < 0.30;

            newDash.waterLevel = (floatWl !== null && !isGhost) ? floatWl.toFixed(2) + ' m' : '-- m';
            newDash.flowRate = (mqttData.sensorFlowRateMps !== null) ? mqttData.sensorFlowRateMps.toFixed(2) + ' m/s' : '-- m/s';

            const level = mqttData.currentAlertLevel || 'OFFLINE';
            newDash.status = isGhost ? 'NORMAL (GHOST FILTERED)' : level;
            if (isGhost) newDash.statusColor = 'text-green-600';
            else if (level === 'RED') newDash.statusColor = 'text-red-600';
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
                setCameraLastUpdated(new Date().toLocaleTimeString());
            } else {
                // Keep the timestamp alive even if image doesn't update (shows system is polling)
                if (!cameraLastUpdated) setCameraLastUpdated(new Date().toLocaleTimeString());
            }
            // Trend Indicator calculations
            if (prevReadings.current.waterLevel !== null && mqttData.waterLevelM !== null) {
                if (mqttData.waterLevelM > prevReadings.current.waterLevel + 0.05) setTrendIndicators(prev => ({ ...prev, waterLevel: '↑' }));
                else if (mqttData.waterLevelM < prevReadings.current.waterLevel - 0.05) setTrendIndicators(prev => ({ ...prev, waterLevel: '↓' }));
                else setTrendIndicators(prev => ({ ...prev, waterLevel: '-' }));
            }
            if (prevReadings.current.flowRate !== null && mqttData.sensorFlowRateMps !== null) {
                if (mqttData.sensorFlowRateMps > prevReadings.current.flowRate + 0.05) setTrendIndicators(prev => ({ ...prev, flowRate: '↑' }));
                else if (mqttData.sensorFlowRateMps < prevReadings.current.flowRate - 0.05) setTrendIndicators(prev => ({ ...prev, flowRate: '↓' }));
                else setTrendIndicators(prev => ({ ...prev, flowRate: '-' }));
            }
            prevReadings.current.waterLevel = mqttData.waterLevelM;
            prevReadings.current.flowRate = mqttData.sensorFlowRateMps;

            loadChartData(telemetryTime, 'TELEMETRY');
            loadChartData(cvTime, 'CV');
        }
    }, [mqttData, demoMode]); // Removed hardwareOnline from here for now to avoid initialization issues

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;

        loadDashboardData();
        loadCameraFeed();
        loadTideData();
        loadChartData(Math.max(telemetryTime, aiTime), 'TELEMETRY');
        loadChartData(cvTime, 'CV');
        loadResidents();
        loadTemplates();
        loadEvacuationSites();
        loadSystemLogsSafe();
        loadDatasetRequests();
        loadPendingCriticalAlerts();
        loadCanaryHealth();

        if (isHeadAdmin) {
            loadAdminUsersData();
        }

        const tideInterval = setInterval(loadTideData, 3600000);
        const logsInterval = setInterval(loadSystemLogsSafe, 45000);
        const criticalInterval = setInterval(loadPendingCriticalAlerts, 15000);
        const canaryInterval = setInterval(loadCanaryHealth, 20000);

        return () => {
            clearInterval(tideInterval);
            clearInterval(logsInterval);
            clearInterval(criticalInterval);
            clearInterval(canaryInterval);
        };
    }, []);

    // Telemetry time changer
    useEffect(() => {
        if (user) loadChartData(Math.max(telemetryTime, aiTime), 'TELEMETRY');
    }, [telemetryTime, aiTime]);

    useEffect(() => {
        if (user) loadChartData(cvTime, 'CV');
    }, [cvTime]);

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

                setCameraLastUpdated(new Date().toLocaleTimeString());

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

                const newData = {
                    timestamp: ts,
                    waterLevelM: newWl,
                    sensorFlowRateMps: randomFlow,
                    imageFlowRateMps: imageFlow,
                    predictedLevel: predicted
                };

                setRawSensorData(prev => [...(Array.isArray(prev) ? prev : []).slice(-89), newData]);
                setCvSensorData(prev => [...(Array.isArray(prev) ? prev : []).slice(-89), newData]);
            }, 3000);
        } else if (user) {
            // When Demo OFF: Immediately purge simulated data. Clear all graphs.
            setRawSensorData([]);
            setDashData(prev => ({
                ...prev,
                waterLevel: '-- m', flowRate: '-- m/s', status: 'OFFLINE', statusColor: 'text-slate-400',
                prediction: '-- m', predColor: 'text-slate-400'
            }));
            setTrendIndicators({ waterLevel: '-', flowRate: '-' });

            // If hardware is disconnected, it will stay blank.
            // If it is connected, loadDashboardData/loadChartData will fetch real data.
            loadDashboardData();
            loadChartData(telemetryTime, 'TELEMETRY');
            loadChartData(cvTime, 'CV');
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
        if (!isHeadAdmin) {
            alert('Only Head Admins can override the system alarm.');
            return;
        }

        let reason = "";
        if (level !== 'NORMAL') {
            reason = prompt(`Reason for Manual Override to ${level}:`);
            if (reason === null) return; // Cancelled
        }

        if (!window.confirm(`Are you sure you want to broadcast a ${level} alert?`)) return;

        try {
            const safeReason = reason || 'Admin Manual Action';
            await overrideAlert(level, safeReason);
            alert(`Alert level forcefully overridden to ${level}`);
            loadDashboardData();
            if (isHeadAdmin) loadAdminUsersData(); // Reload logs
        } catch (e) {
            alert('Error overriding alert.');
        }
    };

    const handleDownloadReport = async (format) => {
        if (format !== 'xlsx') return;
        try {
            const telemetryData = await fetchSensorData(24 * 7); // Export 7 days
            const safeData = Array.isArray(telemetryData) ? telemetryData : [];
            const parseUiDate = (value, endOfDay = false) => {
                if (!value) return null;
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
                if (!match) return null;
                const yyyy = Number(match[1]);
                const mm = Number(match[2]) - 1;
                const dd = Number(match[3]);
                return endOfDay
                    ? new Date(yyyy, mm, dd, 23, 59, 59, 999)
                    : new Date(yyyy, mm, dd, 0, 0, 0, 0);
            };
            const start = parseUiDate(reportStart, false);
            const end = parseUiDate(reportEnd, true);
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
            saveAs(blob, `SurgeAlert_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);

            if (isHeadAdmin) loadAdminUsersData();
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

    const handleAddManualResident = async (e, phoneOverride = null) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            await registerResident({
                fullName: newResidentState.name,
                phoneNumber: phoneOverride || newResidentState.phone,
                isPriority: newResidentState.isPriority
            });
            setIsAddingResident(false);
            setNewResidentState({ name: '', phone: '', isPriority: false });
            loadResidents();
            loadDashboardData();
            alert('Resident manually added successfully.');
        } catch (e) {
            alert('Error adding resident: ' + e.message);
        }
    };

    const handleTogglePriority = async (id) => {
        try {
            await toggleResidentPriority(id);
            loadResidents();
        } catch (e) { alert("Failed to toggle priority: " + e.message); }
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
        if (!window.confirm(`Delete user ${name}?`)) return;
        try {
            await deleteAdminUser(id);
            loadAdminUsersData();
            alert("User deleted.");
        } catch (e) { alert("Failed to delete user."); }
    };

    const switchView = (viewName) => {
        setActiveView(viewName);
        setMobileNavOpen(false);
    };

    const showNavLabels = mobileNavOpen || isSidebarOpen;

    const handleApproveCriticalAlert = async (id) => {
        if (!isHeadAdmin) {
            alert('Only Head Admin can approve critical alerts.');
            return;
        }
        try {
            await approvePendingCriticalAlert(id);
            await loadPendingCriticalAlerts();
            alert('Critical alert approved.');
        } catch (e) {
            alert('Failed to approve critical alert.');
        }
    };

    const handleRejectCriticalAlert = async (id) => {
        if (!isHeadAdmin) {
            alert('Only Head Admin can reject critical alerts.');
            return;
        }
        try {
            await rejectPendingCriticalAlert(id);
            await loadPendingCriticalAlerts();
            alert('Critical alert rejected.');
        } catch (e) {
            alert('Failed to reject critical alert.');
        }
    };

    const handleAdvanceCanaryPhase = async () => {
        try {
            await advanceCanaryPhase();
            await loadCanaryHealth();
            alert('Canary phase advanced.');
        } catch (e) {
            alert('Failed to advance canary phase.');
        }
    };

    const handleRollbackCanaryPhase = async () => {
        try {
            await rollbackCanaryPhase();
            await loadCanaryHealth();
            alert('Canary phase rolled back.');
        } catch (e) {
            alert('Failed to rollback canary phase.');
        }
    };

    const handleUpdateCanaryConfig = async (config) => {
        try {
            await updateCanaryConfig(config);
            await loadCanaryHealth();
            alert('Canary configuration updated successfully.');
        } catch (e) {
            alert('Failed to update canary configuration.');
        }
    };

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

    const telemetryFiltered = rawSensorData.filter(d => new Date(d.timestamp).getTime() >= new Date().getTime() - telemetryTime * 60 * 60 * 1000);
    const aiFiltered = rawSensorData.filter(d => new Date(d.timestamp).getTime() >= new Date().getTime() - aiTime * 60 * 60 * 1000);

    // Telemetry Chart (Multiple Lines)
    const telemetryChartData = {
        datasets: [
            { label: 'Water Level (m)', data: telemetryFiltered.map(d => ({ x: d.timestamp, y: d.waterLevelM })), yAxisID: 'y', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 },
            { label: 'Flow Rate (m/s)', data: telemetryFiltered.map(d => ({ x: d.timestamp, y: d.sensorFlowRateMps })), yAxisID: 'y1', borderColor: '#f59e0b', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.3 }
        ]
    };

    // CV Chart Data
    const cvChartData = {
        datasets: [
            { label: 'Optical Flow (m/s)', data: cvSensorData.map(d => ({ x: d.timestamp, y: d.imageFlowRateMps })), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }
        ]
    };

    // AI Chart (Historical + Future prediction plot logic)
    const nextHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const lastHistorical = aiFiltered.length > 0 ? aiFiltered[aiFiltered.length - 1] : null;

    const aiChartData = {
        datasets: [
            {
                label: 'Historical Level (m)',
                data: aiFiltered.map(d => ({ x: d.timestamp, y: d.waterLevelM })),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3
            },
            {
                label: 'ML Prediction (m)',
                data: lastHistorical ? [
                    { x: lastHistorical.timestamp, y: lastHistorical.waterLevelM },
                    { x: nextHour, y: lastHistorical.predictedLevel }
                ] : [],
                borderColor: '#f59e0b', borderDash: [5, 5], backgroundColor: 'transparent', tension: 0.3
            }
        ]
    };

    const getCommonChartOptions = (timeFrame) => {
        let unit = 'hour';
        let stepSize = 1;
        let tooltipFormat = 'MMM d, p';

        const now = new Date();
        let min = new Date();
        let max = new Date(now);

        if (timeFrame === 1) {
            unit = 'minute';
            stepSize = 10;
            const currentMin = now.getMinutes();
            const roundedMin = Math.floor(currentMin / 10) * 10;
            const alignedNow = new Date(now);
            alignedNow.setMinutes(roundedMin, 0, 0);
            min = new Date(alignedNow.getTime() - 60 * 60 * 1000);
        } else if (timeFrame === 24) {
            unit = 'hour';
            stepSize = 2;
            const currentHour = now.getHours();
            const roundedHour = Math.floor(currentHour / 2) * 2;
            const alignedNow = new Date(now);
            alignedNow.setHours(roundedHour, 0, 0, 0);
            min = new Date(alignedNow.getTime() - 24 * 60 * 60 * 1000);
        } else if (timeFrame === 168) {
            unit = 'day';
            stepSize = 1;
            const alignedNow = new Date(now);
            alignedNow.setHours(0, 0, 0, 0);
            min = new Date(alignedNow.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeFrame === 720) {
            unit = 'day';
            stepSize = 3;
            const alignedNow = new Date(now);
            alignedNow.setHours(0, 0, 0, 0);
            min = new Date(alignedNow.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else {
            min = new Date(now.getTime() - timeFrame * 60 * 60 * 1000);
        }

        return {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: {
                    type: 'time',
                    min: min.toISOString(),
                    max: max.toISOString(),
                    time: {
                        unit: unit,
                        stepSize: stepSize,
                        tooltipFormat: tooltipFormat,
                        displayFormats: {
                            minute: 'h:mm a',
                            hour: 'MMM d h:mm a',
                            day: 'MMM d'
                        }
                    },
                    grid: { display: false }
                }
            }
        };
    };

    const commonChartOptions = getCommonChartOptions(cvTime);
    const aiChartOptions = getCommonChartOptions(aiTime);

    const baseTelemetryOptions = getCommonChartOptions(telemetryTime);
    const telemetryChartOptions = {
        ...baseTelemetryOptions,
        plugins: {
            ...baseTelemetryOptions.plugins,
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
            ...baseTelemetryOptions.scales,
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Level (m)' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Flow (m/s)' }, grid: { drawOnChartArea: false } },
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
        { key: 'ai', label: 'Prediction & Tides', icon: 'fa-brain' },
        { key: 'residents', label: 'Subscribers List', icon: 'fa-users' },
        { key: 'templates', label: 'Message Templates', icon: 'fa-comment-sms' },
        { key: 'datasets', label: 'Data Requests', icon: 'fa-database' },
        { key: 'reports', label: 'Download Reports', icon: 'fa-file-export' },
        { key: 'canary', label: 'System Update Testing', icon: 'fa-code-branch' },
    ];
    if (isHeadAdmin) navItems.push({ key: 'admin_users', label: 'User Management', icon: 'fa-user-shield' });

    // Show nothing (or a spinner) while checking auth in useEffect
    if (!user) {
        return (
            <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
                    <p className="text-xl font-bold">Verifying Session...</p>
                </div>
            </div>
        );
    }

    if (role !== 'ADMIN' && role !== 'HEAD_ADMIN') {
        return null; // The useEffect will handle the redirect
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#0f172a]">
            {mobileNavOpen && (
                <div
                    className="fixed inset-0 z-30 cursor-pointer bg-black/60 md:hidden"
                    aria-hidden
                    onClick={() => setMobileNavOpen(false)}
                    role="presentation"
                />
            )}

            {/* SIDEBAR */}
            <aside
                id="sidebar"
                className={`
                    fixed md:static inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col bg-[#0f172a] text-white shadow-xl transition-transform duration-300 ease-out
                    w-[min(19rem,90vw)] ${isSidebarOpen ? 'md:w-64' : 'md:w-20'}
                    ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
                    ${mobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none md:pointer-events-auto'}
                `}
            >
                {/* Desktop: demo + collapse toggles */}
                <div className="absolute top-2 right-[-40px] z-50 hidden md:flex flex-col">
                    <button type="button" onClick={() => setDemoMode((v) => !v)} className={`p-2 rounded-r-lg shadow-md ${demoMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-600 hover:bg-gray-400'} transition tooltip-parent`}>
                        <i className={`fa-solid ${demoMode ? 'fa-vial-circle-check text-white' : 'fa-vial text-white'}`}></i>
                        <span className="tooltip-text whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded absolute top-full left-0 mt-1 pointer-events-none">Demo Mode</span>
                    </button>
                    <button type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-r-lg shadow-md bg-blue-600 hover:bg-blue-700 text-white mt-1 transition" aria-expanded={isSidebarOpen} aria-label="Toggle sidebar width">
                        <i className={`fa-solid ${isSidebarOpen ? 'fa-chevron-left' : 'fa-bars'}`}></i>
                    </button>
                </div>

                <div className={`flex h-16 sm:h-20 items-center border-b border-gray-700 bg-black bg-opacity-30 px-4 md:px-6 ${showNavLabels ? 'justify-between' : 'justify-center'} overflow-hidden min-w-0`}>
                    <div className={`flex min-w-0 items-center ${showNavLabels ? '' : 'justify-center'}`}>
                        <img src={logoUrl} alt="" className="mr-2 h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12 md:mr-3" aria-hidden />
                        {showNavLabels && (
                            <span className="truncate text-lg font-black tracking-wide text-transparent bg-gradient-to-r from-teal-400 to-blue-300 bg-clip-text sm:text-2xl sm:tracking-wider">
                                SurgeAlert
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="rounded-lg bg-slate-800 p-2 text-white md:hidden"
                        onClick={() => setMobileNavOpen(false)}
                        aria-label="Close navigation menu"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div className={`flex items-center overflow-hidden border-b border-gray-700 bg-black bg-opacity-50 px-4 py-4 md:p-5 ${showNavLabels ? 'gap-3 md:space-x-4' : 'justify-center'}`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-blue-500 text-lg font-bold shadow-lg sm:h-12 sm:w-12 sm:text-xl">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    {showNavLabels && (
                        <div className="min-w-0 flex-1 transition-opacity duration-200">
                            <p className="truncate text-sm font-bold tracking-wide text-white">{displayName}</p>
                            <p className="truncate text-xs font-semibold tracking-wider text-teal-300">{role}</p>
                        </div>
                    )}
                </div>

                <nav className="flex-1 overflow-y-auto overscroll-contain py-4 md:py-6">
                    <ul className="space-y-2 px-3 md:px-4">
                        {navItems.map(item => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onClick={() => switchView(item.key)}
                                    className={`flex w-full items-center rounded-xl p-3 transition-all duration-200 ${activeView === item.key
                                        ? 'scale-[1.01] transform bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-md md:scale-[1.02]'
                                        : 'text-slate-100 hover:bg-gray-800 hover:text-white'
                                        } ${!showNavLabels ? 'justify-center' : ''}`}
                                    title={!showNavLabels ? item.label : ''}
                                >
                                    <i className={`fa-solid ${item.icon} w-6 text-center text-lg`}></i>
                                    {showNavLabels && <span className="ml-2 min-w-0 flex-1 text-left text-sm font-semibold md:ml-3 md:whitespace-nowrap">{item.label}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="border-t border-gray-700 p-4 md:p-5">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className={`flex w-full items-center justify-center rounded-xl bg-red-500 p-3 font-bold text-white shadow transition hover:bg-red-600 hover:shadow-lg ${!showNavLabels ? 'px-0' : ''}`}
                        title="Sign Out"
                    >
                        <i className={`fa-solid fa-right-from-bracket ${showNavLabels ? 'mr-2' : ''}`}></i>
                        {showNavLabels && 'Sign Out'}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-10 pt-4 sm:px-6 md:px-8 md:pb-12 md:pt-6">
                <div className="relative z-20 mb-4 flex shrink-0 items-center gap-3 md:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-white shadow"
                        aria-label="Open navigation menu"
                    >
                        <i className="fa-solid fa-bars text-lg"></i>
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-sky-100">Admin</span>
                    <button
                        type="button"
                        onClick={() => setDemoMode((v) => !v)}
                        className={`shrink-0 rounded-lg px-3 py-2 text-white shadow ${demoMode ? 'bg-orange-500' : 'bg-slate-600'}`}
                        aria-label="Toggle demo mode"
                        title="Demo mode"
                    >
                        <i className={`fa-solid ${demoMode ? 'fa-vial-circle-check' : 'fa-vial'}`}></i>
                    </button>
                </div>
                {(() => {
                    const viewProps = {
                        demoMode, setDemoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, cameraLastUpdated, rawSensorData, cvSensorData, telemetryChartData, cvChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, cvTime, setCvTime, aiChartData, commonChartOptions, aiChartOptions, searchTerm, setSearchTerm, filteredResidents, residents, handleTogglePriority, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, editingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators,
                        openCreateUserModal, openEditUserModal, saveUserModal,
                        beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
                        handleDeleteAdminUser,
                        handleUpdateDatasetStatus, tides, pendingCriticalAlerts, handleApproveCriticalAlert, handleRejectCriticalAlert, canaryState, handleAdvanceCanaryPhase, handleRollbackCanaryPhase, handleUpdateCanaryConfig
                    }; return (<>


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
                        {/* 8. MANUAL CANARY */}
                        {activeView === 'canary' && <CanaryView {...viewProps} />}
                    </>
                    );
                })()}
            </main>
        </div>
    );
}

