import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend, TimeScale, TimeSeriesScale } from 'chart.js';
import { getUser, clearUser } from '../../services/auth.js';
import {
    fetchAlertStatus, fetchCameraFeed as fetchCameraAPI, fetchTidesData, fetchWeatherData,
    fetchLatestEnvironmental, fetchLatestSensorReading,
    fetchPendingCriticalAlerts, approvePendingCriticalAlert, rejectPendingCriticalAlert,
    fetchCanaryHealth, advanceCanaryPhase, rollbackCanaryPhase,
    fetchActiveResidents, deleteResident as deleteResidentAPI,
    fetchTemplates as fetchTemplatesAPI, saveTemplate as saveTemplateAPI,
    fetchSensorData, overrideAlert, downloadReport,
    fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, fetchSystemLogs, fetchEvacuationSites,
    fetchAllDatasetRequests, updateDatasetRequestStatus, registerResidentAsAdmin, updateCanaryConfig,
    toggleResidentPriority,
} from '../../services/api.js';
import { computeHardwareHealth } from '../../utils/edgeConnectivity.js';
import {
    isCsvDemoFallbackEnabled,
    pickNewestSensorRow,
    resolveSensorFlowMps,
    resolveSensorHeartbeatMs,
    statusToSensorRow,
} from '../../utils/sensorTimeseries.js';
import { useLatestSensorPolling } from '../../hooks/useLatestSensorPolling.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logoUrl } from '../../branding/logo.js';
import { DISPLAY_TIMEZONE, TIDE_DISPLAY_TIMEZONE, formatManilaWallClockFromMs, formatManilaWallDateFromMs } from '../../constants/displayTime.js';
import { useLiveManilaClock } from '../../hooks/useLiveManilaClock.js';
import { normalizeSensorInstant } from '../../utils/sensorTimeseries.js';

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
    const mqttData = useLatestSensorPolling();

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
    const [overrideContext, setOverrideContext] = useState({
        active: false,
        official: null,
        sensor: null,
    });
    const [dashData, setDashData] = useState({
        waterLevel: '-- m', flowRate: '-- m/s', riseRate: null, status: 'Normal', statusColor: 'text-green-600',
        prediction: '-- m', predictedClassification: '--', predColor: 'text-slate-400', subscriberCount: 0,
        batteryLevel: '--',
        qcRain: '-- mm', marulasRain: '-- mm', tideHeight: '-- m', 
        pressure: '-- hPa', wind: '-- kph'
    });
    const [cameraImg, setCameraImg] = useState(null);
    const [cameraCaptureLabel, setCameraCaptureLabel] = useState(null);
    const lastCameraB64Ref = useRef(null);
    const { clockLabel: liveManilaClock, dateLabel: liveManilaClockDate } = useLiveManilaClock();
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
    const [reportRaw, setReportRaw] = useState(true);
    const [reportCalculated, setReportCalculated] = useState(true);
    const [reportAlerts, setReportAlerts] = useState(true);
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [trendIndicators, setTrendIndicators] = useState({ waterLevel: '-', flowRate: '-' });
    const prevReadings = useRef({ waterLevel: null, flowRate: null });
    const [lastMqttAt, setLastMqttAt] = useState(null);
    const [cachedSensorRow, setCachedSensorRow] = useState(null);
    const [ageTick, setAgeTick] = useState(0);
    const [evacuationSites, setEvacuationSites] = useState([]);
    const [pendingCriticalAlerts, setPendingCriticalAlerts] = useState([]);
    const [canaryState, setCanaryState] = useState(null);
    const evacuationSitesRef = useRef([]);

    const hardwareHealth = useMemo(
        () => computeHardwareHealth(lastMqttAt, mqttData ?? cachedSensorRow),
        [lastMqttAt, mqttData, cachedSensorRow, ageTick]
    );
    const hardwareOnline = hardwareHealth.edgeConnected;

    const normalizeTideType = (type) => {
        const value = String(type || '').toLowerCase();
        if (value === 'high' || value === 'h') return 'High';
        if (value === 'low' || value === 'l') return 'Low';
        return null;
    };

    const buildTideEvents = (data) => {
        const extremeEvents = Array.isArray(data?.extremes)
            ? data.extremes
                .map((event) => ({
                    ...event,
                    type: normalizeTideType(event?.type),
                    dt: Number(event?.dt)
                }))
                .filter((event) => event.type && Number.isFinite(event.dt))
            : [];

        const hasHigh = extremeEvents.some((event) => event.type === 'High');
        const hasLow = extremeEvents.some((event) => event.type === 'Low');
        if (hasHigh && hasLow) return extremeEvents.sort((a, b) => a.dt - b.dt);

        const heights = Array.isArray(data?.heights) ? data.heights : [];
        const inferred = [];
        for (let i = 1; i < heights.length - 1; i++) {
            const prev = Number(heights[i - 1]?.height);
            const curr = Number(heights[i]?.height);
            const next = Number(heights[i + 1]?.height);
            const dt = Number(heights[i]?.dt);
            if (![prev, curr, next, dt].every(Number.isFinite)) continue;

            if ((!hasHigh && curr > prev && curr > next) || (!hasLow && curr < prev && curr < next)) {
                inferred.push({
                    dt,
                    height: curr,
                    type: curr > prev && curr > next ? 'High' : 'Low'
                });
            }
        }

        const merged = [...extremeEvents];
        for (const event of inferred) {
            const duplicate = merged.some(
                (existing) => existing.type === event.type && Math.abs(existing.dt - event.dt) <= 3600
            );
            if (!duplicate) merged.push(event);
        }
        return merged.sort((a, b) => a.dt - b.dt);
    };

    const displayName = (user && (user.fullName || user.username)) || 'Admin';

    const touchSensorRow = (row) => {
        if (!row) return;
        setCachedSensorRow(row);
        if (!row.timestamp || isCsvDemoFallbackEnabled()) return;
        const tsIso = normalizeSensorInstant(row.timestamp);
        const ms = tsIso ? Date.parse(tsIso) : NaN;
        if (Number.isFinite(ms)) setLastMqttAt(ms);
    };

    const mergePollIntoDashData = (prev, row) => {
        if (!row) return prev;
        const next = { ...prev };
        const floatWl = row.waterLevelM;
        const isGhost = floatWl !== null && floatWl !== undefined && floatWl < 0.10;

        if (floatWl !== null && floatWl !== undefined && !isGhost) {
            next.waterLevel = floatWl.toFixed(2) + ' m';
        }
        const flowMps = resolveSensorFlowMps(row);
        if (flowMps !== null && flowMps !== undefined) {
            next.flowRate = flowMps.toFixed(2) + ' m/s';
        }
        if (row.riseRate !== null && row.riseRate !== undefined) {
            next.riseRate = row.riseRate;
        }
        if (row.predictedLevel !== null && row.predictedLevel !== undefined) {
            next.prediction = row.predictedLevel.toFixed(2) + ' m';
        }
        if (row.predictedAlertLevel) {
            next.predictedClassification = row.predictedAlertLevel;
        }
        if (row.rainMm !== null && row.rainMm !== undefined) next.qcRain = row.rainMm.toFixed(1) + ' mm';
        if (row.marulasRainMm !== null && row.marulasRainMm !== undefined) next.marulasRain = row.marulasRainMm.toFixed(1) + ' mm';
        if (row.tideHeightM !== null && row.tideHeightM !== undefined) next.tideHeight = row.tideHeightM.toFixed(2) + ' m';
        if (row.pressureHpa !== null && row.pressureHpa !== undefined) next.pressure = row.pressureHpa.toFixed(0) + ' hPa';
        if (row.windSpeedKph !== null && row.windSpeedKph !== undefined) next.wind = row.windSpeedKph.toFixed(1) + ' kph';
        return next;
    };

    const applyCameraSnapshot = (base64, capturedAtIso) => {
        if (!base64) return;
        const ts = capturedAtIso ? normalizeSensorInstant(capturedAtIso) : null;
        const cacheKey = `${base64.length}:${ts || ''}`;
        if (lastCameraB64Ref.current === cacheKey) return;
        lastCameraB64Ref.current = cacheKey;
        setCameraImg(`data:image/jpeg;base64,${base64}`);
        if (ts) {
            const ms = Date.parse(ts);
            if (Number.isFinite(ms)) {
                setCameraCaptureLabel({
                    clock: formatManilaWallClockFromMs(ms),
                    date: formatManilaWallDateFromMs(ms),
                });
            }
        }
    };

    // -------------------------------------------------------------
    // DATA LOADING
    // -------------------------------------------------------------
    const loadDashboardData = async () => {
        try {
            // 1. Get official Alert Status (Level + Water Level)
            const statusData = await fetchAlertStatus();
            
            // 2. Latest telemetry — /latest first (same row as alert status), then 24h recent for charts
            let latest = await fetchLatestSensorReading();
            if (!latest) {
                const recentRows = await fetchSensorData(24);
                latest = pickNewestSensorRow(recentRows);
            }

            const statusRow = statusToSensorRow(statusData);
            const heartbeatMs = resolveSensorHeartbeatMs(latest ?? statusRow, statusData);
            if (Number.isFinite(heartbeatMs)) setLastMqttAt(heartbeatMs);

            const mergedLatest = latest ?? statusRow;
            if (mergedLatest) touchSensorRow(mergedLatest);
            if (mergedLatest?.snapshotBase64) {
                applyCameraSnapshot(mergedLatest.snapshotBase64, mergedLatest.timestamp);
            }
            let subCount;
            try {
                const res = await fetchActiveResidents();
                subCount = res.length;
            } catch (e) {
                subCount = Array.isArray(residents) ? residents.length : 0;
            }

            // 3. Fetch environmental data DIRECTLY from tide_metrics + weather_metrics tables
            const envData = await fetchLatestEnvironmental().catch(() => null);
            const resolvedEnvTideHeight =
                (envData?.tideHeightM !== null && envData?.tideHeightM !== undefined) ? envData.tideHeightM
                    : (envData?.tideHeight !== null && envData?.tideHeight !== undefined) ? envData.tideHeight
                        : (envData?.Tide_Height_m !== null && envData?.Tide_Height_m !== undefined) ? envData.Tide_Height_m
                            : null;

            setDashData((prev) => {
                const newDash = { ...prev };
                
                const kpiRow = mergedLatest ?? statusRow;
                const sensorWlM = (kpiRow?.waterLevelM ?? statusData.waterLevelM ?? statusData.water_level);
                newDash.waterLevel = (sensorWlM !== null && sensorWlM !== undefined) ? sensorWlM.toFixed(2) + ' m' : '--';
                const level = statusData.alertLevel || 'OFFLINE';
                newDash.status = level;
                setOverrideContext({
                    active: Boolean(statusData.manualOverrideActive),
                    official: level,
                    sensor: statusData.sensorAlertLevel || latest?.currentAlertLevel || null,
                });
                if (level === 'CRITICAL') newDash.statusColor = 'text-purple-600 font-black animate-pulse';
                else if (level === 'RED') newDash.statusColor = 'text-red-600';
                else if (level === 'ORANGE') newDash.statusColor = 'text-orange-500';
                else if (level === 'YELLOW') newDash.statusColor = 'text-yellow-500';
                else if (level === 'GREEN') newDash.statusColor = 'text-green-600';
                else newDash.statusColor = 'text-slate-400';

                // KPIs from latest row and /public/alerts/status (flow + ML often only on status when /latest parse fails)
                if (kpiRow) {
                    const flowMps = resolveSensorFlowMps(kpiRow)
                        ?? resolveSensorFlowMps(statusData);
                    if (flowMps !== null && flowMps !== undefined) {
                        newDash.flowRate = flowMps.toFixed(2) + ' m/s';
                    }
                    const rise = kpiRow.riseRate;
                    if (rise !== null && rise !== undefined) {
                        newDash.riseRate = rise;
                    }
                    const pred = kpiRow.predictedLevel ?? statusData.predictedLevel ?? statusData.predicted_level;
                    if (pred !== null && pred !== undefined) {
                        newDash.prediction = Number(pred).toFixed(2) + ' m';
                    }
                    const predAlert = kpiRow.predictedAlertLevel
                        ?? statusData.predictedAlertLevel ?? statusData.predicted_alert_level;
                    if (predAlert) {
                        newDash.predictedClassification = predAlert;
                    }
                    // Keep legacy latest-record fallback only when ml_features_realtime is empty.
                    if (!envData) {
                        if (kpiRow.rainMm !== null && kpiRow.rainMm !== undefined) newDash.qcRain = kpiRow.rainMm.toFixed(1) + ' mm';
                        if (kpiRow.marulasRainMm !== null && kpiRow.marulasRainMm !== undefined) newDash.marulasRain = kpiRow.marulasRainMm.toFixed(1) + ' mm';
                        if (kpiRow.tideHeightM !== null && kpiRow.tideHeightM !== undefined) newDash.tideHeight = kpiRow.tideHeightM.toFixed(2) + ' m';
                        if (kpiRow.pressureHpa !== null && kpiRow.pressureHpa !== undefined) newDash.pressure = kpiRow.pressureHpa.toFixed(0) + ' hPa';
                        if (kpiRow.windSpeedKph !== null && kpiRow.windSpeedKph !== undefined) newDash.wind = kpiRow.windSpeedKph.toFixed(1) + ' kph';
                    }
                }

                // Apply ml_features_realtime values (authoritative for Environmental Context cards)
                if (envData) {
                    if (envData.qcRainMm !== null && envData.qcRainMm !== undefined) {
                        newDash.qcRain = envData.qcRainMm.toFixed(1) + ' mm';
                    }
                    if (envData.marulasRainMm !== null && envData.marulasRainMm !== undefined) {
                        newDash.marulasRain = envData.marulasRainMm.toFixed(1) + ' mm';
                    }
                    if (resolvedEnvTideHeight !== null && resolvedEnvTideHeight !== undefined) {
                        newDash.tideHeight = Number(resolvedEnvTideHeight).toFixed(2) + ' m';
                    }
                    if (envData.pressureHpa !== null && envData.pressureHpa !== undefined) {
                        newDash.pressure = envData.pressureHpa.toFixed(0) + ' hPa';
                    }
                    if (envData.windSpeed !== null && envData.windSpeed !== undefined) {
                        newDash.wind = envData.windSpeed.toFixed(1) + ' kph';
                    }
                }

                if (subCount !== undefined) newDash.subscriberCount = subCount;
                return newDash;
            });
        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    };


    const loadCameraFeed = async () => {
        try {
            const latest = await fetchLatestSensorReading();
            if (latest?.snapshotBase64) {
                applyCameraSnapshot(latest.snapshotBase64, latest.timestamp);
                return;
            }
            const data = await fetchCameraAPI();
            if (data?.img_base64) {
                applyCameraSnapshot(data.img_base64, data.captured_at || data.capturedAt);
            }
        } catch (e) { console.error("Camera fetch error:", e); }
    };

    const loadTideData = async () => {
        try {
            const primary = await fetchTidesData(false);
            let tideEvents = buildTideEvents(primary);
            const hasFutureHigh = tideEvents.some((event) => event.type === 'High' && (event.dt * 1000) > Date.now());
            const hasFutureLow = tideEvents.some((event) => event.type === 'Low' && (event.dt * 1000) > Date.now());

            if ((!hasFutureHigh || !hasFutureLow) && !primary?.error) {
                const refreshed = await fetchTidesData(true);
                const refreshedEvents = buildTideEvents(refreshed);
                if (refreshedEvents.length > 0) tideEvents = refreshedEvents;
            }

            if (tideEvents.length > 0) {
                setTides(tideEvents);
                const now = Date.now();
                const futureTides = tideEvents.filter((t) => (t.dt * 1000) > now);
                if (futureTides.length > 0) setNextTide(futureTides[0]);
            }
        } catch (e) { console.error(e); }
    };

    const loadChartData = async (hours, type = 'TELEMETRY') => {
        try {
            let incoming = await fetchSensorData(hours);
            if (!incoming?.length) {
                const fallback = await fetchLatestSensorReading();
                if (fallback) incoming = [fallback];
            }
            const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
            /** Hard cap so very fast ingest (e.g. 1 Hz) cannot freeze the dashboard; Chart.js still decimates. */
            const maxPointsSafety = 20000;

            const mergeSeries = (prev, next) => {
                const byTimestamp = new Map();
                [...(prev || []), ...(next || [])].forEach((row) => {
                    const key = row?.timestamp ? String(row.timestamp) : null;
                    if (!key) return;
                    const t = new Date(row.timestamp).getTime();
                    if (Number.isFinite(t) && t >= cutoffMs) byTimestamp.set(key, row);
                });
                let merged = Array.from(byTimestamp.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                if (merged.length > maxPointsSafety) merged = merged.slice(-maxPointsSafety);
                return merged;
            };

            if (type === 'TELEMETRY') {
                setRawSensorData((prev) => {
                    const merged = mergeSeries(prev, incoming);
                    if (merged.length > 0) {
                        const latest = merged[merged.length - 1];
                        const chartFlow = resolveSensorFlowMps(latest);
                        setDashData((prevDash) => ({
                            ...prevDash,
                            flowRate: (chartFlow !== null && chartFlow !== undefined)
                                ? chartFlow.toFixed(2) + ' m/s'
                                : prevDash.flowRate,
                            prediction: (latest.predictedLevel !== null && latest.predictedLevel !== undefined)
                                ? latest.predictedLevel.toFixed(2) + ' m'
                                : prevDash.prediction,
                            predictedClassification: latest.predictedAlertLevel || prevDash.predictedClassification || '--',
                        }));
                    }
                    return merged;
                });
            } else if (type === 'CV') {
                setCvSensorData((prev) => mergeSeries(prev, incoming));
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
        if (!mqttData?.timestamp) return;

        touchSensorRow(mqttData);
        setDashData((prev) => mergePollIntoDashData(prev, mqttData));

        const floatWl = mqttData.waterLevelM;
        const isGhost = floatWl !== null && floatWl !== undefined && floatWl < 0.10;
        const sensorLevel = isGhost ? null : (mqttData.currentAlertLevel || null);
        setOverrideContext((prev) => ({
            ...prev,
            sensor: sensorLevel ?? prev.sensor,
        }));

        if (mqttData.snapshotBase64) {
            applyCameraSnapshot(mqttData.snapshotBase64, mqttData.timestamp);
        }

        if (prevReadings.current.waterLevel !== null && mqttData.waterLevelM !== null) {
            if (mqttData.waterLevelM > prevReadings.current.waterLevel + 0.05) setTrendIndicators(prev => ({ ...prev, waterLevel: '↑' }));
            else if (mqttData.waterLevelM < prevReadings.current.waterLevel - 0.05) setTrendIndicators(prev => ({ ...prev, waterLevel: '↓' }));
            else setTrendIndicators(prev => ({ ...prev, waterLevel: '-' }));
        }
        if (prevReadings.current.flowRate !== null && mqttData.sensorFlowRate !== null) {
            if (mqttData.sensorFlowRate > prevReadings.current.flowRate + 0.05) setTrendIndicators(prev => ({ ...prev, flowRate: '↑' }));
            else if (mqttData.sensorFlowRate < prevReadings.current.flowRate - 0.05) setTrendIndicators(prev => ({ ...prev, flowRate: '↓' }));
            else setTrendIndicators(prev => ({ ...prev, flowRate: '-' }));
        }
        prevReadings.current.waterLevel = mqttData.waterLevelM;
        prevReadings.current.flowRate = mqttData.sensorFlowRate;

        if (hardwareOnline) {
            loadChartData(Math.max(telemetryTime, aiTime), 'TELEMETRY');
            loadChartData(cvTime, 'CV');
        }
    }, [mqttData, hardwareOnline, user, role, telemetryTime, aiTime, cvTime]);

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

    useEffect(() => {
        if (!user || (role !== 'ADMIN' && role !== 'HEAD_ADMIN')) return;

        const pollMs = 10000;
        const id = setInterval(() => {
            loadDashboardData();
            loadCameraFeed();
            loadChartData(Math.max(telemetryTime, aiTime), 'TELEMETRY');
            loadChartData(cvTime, 'CV');
        }, pollMs);

        return () => clearInterval(id);
    }, [user, role, telemetryTime, aiTime, cvTime]);

    // Telemetry time changer
    useEffect(() => {
        if (user) loadChartData(Math.max(telemetryTime, aiTime), 'TELEMETRY');
    }, [telemetryTime, aiTime]);

    useEffect(() => {
        if (user) loadChartData(cvTime, 'CV');
    }, [cvTime]);

    useEffect(() => {
        const t = setInterval(() => setAgeTick((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

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
            alert(e?.message || 'Error overriding alert.');
        }
    };

    const handleDownloadReport = async (format) => {
        try {
            // Use the backend CSV generator which handles massive datasets and proper date filtering
            const blob = await downloadReport(reportStart, reportEnd, reportRaw, reportCalculated, reportAlerts, reportAI);
            
            // Create a temporary link to download the blob
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SurgeAlert_Report_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            if (isHeadAdmin) loadAdminUsersData();
        } catch (e) {
            console.error(e);
            alert('Error generating report from backend. Please ensure dates are valid.');
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
            await registerResidentAsAdmin({
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
        setMobileNavOpen(false);
        setShowUserModal(true);
    };

    const openEditUserModal = (user) => {
        setEditingUser(user.id);
        setUserForm({ fullName: user.fullName, username: user.username, password: '', role: user.role });
        setMobileNavOpen(false);
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
            setMobileNavOpen(false);
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
        if (predVal >= 5.5) return 'RED';
        if (predVal >= 4.5) return 'ORANGE';
        if (predVal >= 3.5) return 'YELLOW';
        return 'NORMAL';
    };

    const aiRecommendedStatus = getAiRecommendedStatus();
    const isDivergent = (dashData.status !== aiRecommendedStatus) && (aiRecommendedStatus !== 'NORMAL');

    // -------------------------------------------------------------
    // CHART CONFIGURATIONS
    // -------------------------------------------------------------

    // Chronological order required so Chart.js draws one continuous trend line.
    const sortedTelemetry = [...(rawSensorData || [])].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const sortedCv = [...(cvSensorData || [])].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const cutoffMsForHours = (hours) => Date.now() - hours * 60 * 60 * 1000;
    const sensorRowsThrough = (rows, hours) => {
        const cutoff = cutoffMsForHours(hours);
        return (rows || []).filter((r) => {
            const t = new Date(r.timestamp).getTime();
            return Number.isFinite(t) && t >= cutoff;
        });
    };
    const telemetryForChart = sensorRowsThrough(sortedTelemetry, telemetryTime);
    const cvForChart = sensorRowsThrough(sortedCv, cvTime);
    const aiForChart = sensorRowsThrough(sortedTelemetry, aiTime);

    const lineDatasetOpts = {
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 6,
        spanGaps: true,
    };

    // Telemetry Chart (Multiple Lines) — sensor_data: water_level, sensor_flow_rate_mps
    const telemetryChartData = {
        datasets: [
            { ...lineDatasetOpts, label: 'Water Level (m)', data: telemetryForChart.map(d => ({ x: d.timestamp, y: d.waterLevelM })), yAxisID: 'y', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.25 },
            { ...lineDatasetOpts, label: 'Flow Rate (m/s)', data: telemetryForChart.map(d => ({ x: d.timestamp, y: d.sensorFlowRate })), yAxisID: 'y1', borderColor: '#f59e0b', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.25, fill: false }
        ]
    };

    // CV Chart — sensor_data: image_flow_rate_mps
    const cvChartData = {
        datasets: [
            { ...lineDatasetOpts, label: 'Optical Flow (m/s)', data: cvForChart.map(d => ({ x: d.timestamp, y: d.imageFlowRate })), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.25 }
        ]
    };

    // AI Chart — sensor_data: water_level + predicted_level (segment to +1h)
    const lastHistorical = aiForChart.length > 0 ? aiForChart[aiForChart.length - 1] : null;
    const nextHour = lastHistorical 
        ? new Date(new Date(lastHistorical.timestamp).getTime() + 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const aiChartData = {
        datasets: [
            {
                ...lineDatasetOpts,
                label: 'Historical Level (m)',
                data: aiForChart.map(d => ({ x: d.timestamp, y: d.waterLevelM })),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.25
            },
            {
                ...lineDatasetOpts,
                label: 'ML Prediction (m)',
                data: lastHistorical ? [
                    { x: lastHistorical.timestamp, y: lastHistorical.waterLevelM },
                    { x: nextHour, y: lastHistorical.predictedLevel }
                ] : [],
                borderColor: '#f59e0b', borderDash: [6, 4], backgroundColor: 'transparent', tension: 0, fill: false,
                pointRadius: 3,
            }
        ]
    };

    /** Time scale: do not set min/max — fixed windows often clipped 5‑minute series and hid trend lines. */
    const getCommonChartOptions = (timeFrame) => {
        let unit = 'hour';
        let stepSize = 1;
        let tooltipFormat = 'MMM d, p';

        if (timeFrame === 1) {
            unit = 'minute';
            stepSize = 10;
        } else if (timeFrame === 24) {
            unit = 'hour';
            stepSize = 2;
        } else if (timeFrame === 168) {
            unit = 'day';
            stepSize = 1;
        } else if (timeFrame === 720) {
            unit = 'day';
            stepSize = 3;
        }

        return {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' }, decimation: { enabled: true, algorithm: 'lttb', samples: 500 } },
            scales: {
                x: {
                    type: 'time',
                    bounds: 'data',
                    adapters: {
                        date: {
                            zone: DISPLAY_TIMEZONE,
                        },
                    },
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
                    box1: { type: 'box', yMin: 0, yMax: 3.5, backgroundColor: 'rgba(74, 222, 128, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                    box2: { type: 'box', yMin: 3.5, yMax: 4.5, backgroundColor: 'rgba(250, 204, 21, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                    box3: { type: 'box', yMin: 4.5, yMax: 5.5, backgroundColor: 'rgba(251, 146, 60, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                    box4: { type: 'box', yMin: 5.5, yMax: 10, backgroundColor: 'rgba(248, 113, 113, 0.1)', drawTime: 'beforeDraw', borderWidth: 0 },
                }
            }
        },
        scales: {
            ...baseTelemetryOptions.scales,
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Level (m)' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Flow (m/s)' }, grid: { drawOnChartArea: false } },
        }
    };

    const getWaterLevelContext = () => {
        const levelStr = String(dashData.waterLevel).replace(/[^0-9.-]/g, '');
        const level = parseFloat(levelStr);
        if (Number.isNaN(level)) return '—';
        if (level < 3.5) return 'Normal';
        if (level < 4.5) return 'Caution (Yellow)';
        if (level < 5.5) return 'Prepare (Orange)';
        return 'Danger (Red)';
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

    const formatTideDateUtc = (value) => new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: TIDE_DISPLAY_TIMEZONE
    });

    const formatTideTimeUtc = (value) => new Date(value).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIDE_DISPLAY_TIMEZONE
    });

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
                </div>
                {(() => {
                    const viewProps = {
                        hardwareOnline, hardwareHealth, lastSensorAtMs: lastMqttAt, isHeadAdmin, overrideContext, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, latestLogs, nextTide, cameraImg, cameraCaptureLabel, liveManilaClock, liveManilaClockDate, rawSensorData, cvSensorData, telemetryChartData, cvChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, cvTime, setCvTime, aiChartData, commonChartOptions, aiChartOptions, searchTerm, setSearchTerm, filteredResidents, residents, handleTogglePriority, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, 
                        reportRaw, setReportRaw, reportCalculated, setReportCalculated, reportAlerts, setReportAlerts,
                        reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, editingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators,
                        openCreateUserModal, openEditUserModal, saveUserModal,
                        beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
                        handleDeleteAdminUser,
                        handleUpdateDatasetStatus, tides, pendingCriticalAlerts, handleApproveCriticalAlert, handleRejectCriticalAlert, canaryState, handleAdvanceCanaryPhase, handleRollbackCanaryPhase, handleUpdateCanaryConfig,
                        formatTideDateUtc, formatTideTimeUtc
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

