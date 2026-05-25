import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlertStatus, fetchAlertGuide, fetchCameraFeed, fetchWeatherData, fetchTidesData, getWeatherInfo, fetchSystemThresholds, fetchLatestSensorReading } from '../services/api.js';
import { useLatestSensorPolling } from '../hooks/useLatestSensorPolling.js';
import { useLiveManilaClock } from '../hooks/useLiveManilaClock.js';
import { classifyAlertLevel, gaugeFillPercent, gaugeMarkers } from '../config/alertConfig.js';

import { DISPLAY_TIMEZONE, TIDE_DISPLAY_TIMEZONE, formatSensorAge, formatManilaWallClockFromMs, formatManilaWallDateFromMs } from '../constants/displayTime.js';
import { LIVE_DATA_POLL_MS } from '../constants/livePolling.js';
import { normalizeSensorInstant, resolveSensorHeartbeatMs, statusToSensorRow } from '../utils/sensorTimeseries.js';

let CACHED_GUIDE = null;

/** Polls GET /public/alerts/status (includes manual override). */
const ALERT_STATUS_POLL_MS = LIVE_DATA_POLL_MS;

function getAlertColors(levelKey) {
    if (levelKey === 'green') return { bg: 'bg-[#1e293b]', border: 'border-green-500', text: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.3)]' };
    if (levelKey === 'yellow') return { bg: 'bg-[#1e293b]', border: 'border-yellow-400', text: 'text-yellow-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]' };
    if (levelKey === 'orange') return { bg: 'bg-[#1e293b]', border: 'border-orange-500', text: 'text-orange-500', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]' };
    if (levelKey === 'red') return { bg: 'bg-[#1e293b]', border: 'border-red-600', text: 'text-red-500', glow: 'shadow-[0_0_15px_rgba(220,38,38,0.4)]' };
    return { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-400', glow: '' };
}

export default function Home() {
    const navigate = useNavigate();
    const mqttData = useLatestSensorPolling();
    const { clockLabel: liveManilaClock } = useLiveManilaClock();

    // State
    const [waterLevel, setWaterLevel] = useState('--.-- m');
    const [alertLevelText, setAlertLevelText] = useState('LOADING...');
    const [alertLevelKey, setAlertLevelKey] = useState('green');
    const [alertHtml, setAlertHtml] = useState('<p class="text-gray-400">System is running normally.</p>');
    const [cameraImg, setCameraImg] = useState(null);
    const [lastSensorAtMs, setLastSensorAtMs] = useState(null);
    const [cameraCaptureClock, setCameraCaptureClock] = useState(null);
    const [cameraCaptureDate, setCameraCaptureDate] = useState(null);
    const [sensorAgeTick, setSensorAgeTick] = useState(0);
    const [weatherCards, setWeatherCards] = useState([]);
    const [weatherError, setWeatherError] = useState(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(true);
    const [tides, setTides] = useState([]);
    const [tidesError, setTidesError] = useState(null);
    const [isTidesLoading, setIsTidesLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(true);
    // Thresholds fetched from backend (driven by SENSOR_DEPTH_M in .env)
    const [sensorConfig, setSensorConfig] = useState({
        sensorDepthM: 6.1,
        thresholds: { yellow: 3.50, orange: 4.50, red: 5.50 }
    });

    const sensorConfigRef = useRef(sensorConfig);
    useEffect(() => {
        sensorConfigRef.current = sensorConfig;
    }, [sensorConfig]);

    const touchSensorTimestamp = (timestamp) => {
        if (!timestamp) return;
        const tsIso = normalizeSensorInstant(timestamp);
        const ms = tsIso ? Date.parse(tsIso) : NaN;
        if (Number.isFinite(ms)) setLastSensorAtMs(ms);
    };

    const applyCameraCaptureLabel = (timestamp) => {
        if (!timestamp) return;
        const tsIso = normalizeSensorInstant(timestamp);
        const ms = tsIso ? Date.parse(tsIso) : NaN;
        if (!Number.isFinite(ms)) return;
        setCameraCaptureClock(formatManilaWallClockFromMs(ms));
        setCameraCaptureDate(formatManilaWallDateFromMs(ms));
    };

    const sensorAge = formatSensorAge(lastSensorAtMs);

    useEffect(() => {
        const t = setInterval(() => setSensorAgeTick((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    /** River gauge tap-to-scroll is intended for phone/tablet (matches max-lg breakpoint). */
    const [isCompactLayout, setIsCompactLayout] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 1023px)');
        const apply = () => setIsCompactLayout(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    const scrollToSafetyGuide = () => {
        document.getElementById('safety-action-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleGaugeCardNavigate = () => {
        if (!isCompactLayout) return;
        scrollToSafetyGuide();
    };

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
        if (hasHigh && hasLow) return extremeEvents;

        const heights = Array.isArray(data?.heights) ? data.heights : [];
        const inferredExtremes = [];
        for (let i = 1; i < heights.length - 1; i++) {
            const prev = Number(heights[i - 1]?.height);
            const curr = Number(heights[i]?.height);
            const next = Number(heights[i + 1]?.height);
            const dt = Number(heights[i]?.dt);
            if (![prev, curr, next, dt].every(Number.isFinite)) continue;

            if ((!hasHigh && curr > prev && curr > next) || (!hasLow && curr < prev && curr < next)) {
                inferredExtremes.push({
                    dt,
                    height: curr,
                    type: curr > prev && curr > next ? 'High' : 'Low'
                });
            }
        }

        const merged = [...extremeEvents];
        for (const inferred of inferredExtremes) {
            const duplicate = merged.some(
                (existing) => existing.type === inferred.type && Math.abs(existing.dt - inferred.dt) <= 3600
            );
            if (!duplicate) merged.push(inferred);
        }

        return merged.sort((a, b) => a.dt - b.dt);
    };

    const getCurrentTideSummary = (events) => {
        if (!Array.isArray(events) || events.length === 0) return { status: 'Normal', nextHigh: null, nextLow: null };
        const nowMs = Date.now();
        const sorted = [...events].sort((a, b) => a.dt - b.dt);
        const upcoming = sorted.filter((t) => (t.dt * 1000) > nowMs);
        const nextHigh = upcoming.find((t) => normalizeTideType(t.type) === 'High') || null;
        const nextLow = upcoming.find((t) => normalizeTideType(t.type) === 'Low') || null;

        const closest = sorted.reduce((a, b) => {
            return Math.abs(a.dt * 1000 - nowMs) < Math.abs(b.dt * 1000 - nowMs) ? a : b;
        }, sorted[0]);

        let status = 'Normal';
        const diffMins = Math.abs(closest.dt * 1000 - nowMs) / (1000 * 60);

        if (diffMins <= 15) {
            status = normalizeTideType(closest.type) === 'High' ? 'High Tide' : 'Low Tide';
        } else {
            if (upcoming.length > 0) {
                status = normalizeTideType(upcoming[0].type) === 'High' ? 'Rising' : 'Falling';
            }
        }

        return { status, nextHigh, nextLow };
    };

    // Data fetching functions
    const loadAlertStatus = async () => {
        try {
            if (!CACHED_GUIDE) CACHED_GUIDE = await fetchAlertGuide();
            const data = await fetchAlertStatus();
            const statusRow = statusToSensorRow(data);
            const heartbeatMs = resolveSensorHeartbeatMs(null, data);
            if (Number.isFinite(heartbeatMs)) setLastSensorAtMs(heartbeatMs);

            const isOverride = data.manualOverrideActive
                || (data.description && data.description.includes('OVERRIDE'));
            const alertLevel = data.alertLevel ?? data.alert_level ?? 'GREEN';
            const waterM = statusRow?.waterLevelM ?? data.waterLevelM ?? data.water_level;
            processAlertData(alertLevel, waterM, isOverride);
        } catch (error) {
            console.error("Failed to fetch status:", error);
            // Fallback path: pull directly from latest sensor_data when public status endpoint fails.
            try {
                const latest = await fetchLatestSensorReading();
                if (latest?.timestamp) touchSensorTimestamp(latest.timestamp);
                if (latest?.waterLevelM !== null && latest?.waterLevelM !== undefined) {
                    processAlertData(latest.currentAlertLevel || 'GREEN', latest.waterLevelM, false);
                    return;
                }
            } catch {
                // Keep UI responsive even when all data sources fail.
            }
            setAlertLevelText('NORMAL');
            setAlertLevelKey('green');
            setAlertHtml('<p class="text-gray-400">System is running normally.</p>');
        }
    };

    const processAlertData = (rawLevel, currentLevel, isOverride = false) => {
        if (rawLevel === 'OFFLINE' || currentLevel === null) {
            setIsOffline(true);
            return;
        }

        setIsOffline(false);
        const floatVal = typeof currentLevel === 'number' ? currentLevel : parseFloat(currentLevel);
        if (!Number.isFinite(floatVal)) {
            return;
        }

        // NOISE FILTER: Anything below 0.10m is considered "Offline" ghost data in river mode
        if (floatVal < 0.10 && !isOverride) {
            setIsOffline(true);
            return;
        }

        const levelMap = {
            GREEN: 'green', YELLOW: 'yellow', ORANGE: 'orange', RED: 'red',
        };
        let normalized = String(rawLevel || 'GREEN').toUpperCase();
        if (normalized === 'CRITICAL') normalized = 'RED';
        const levelKey = isOverride
            ? rawLevel.toLowerCase()
            : (levelMap[normalized] || classifyAlertLevel(floatVal, sensorConfigRef.current.thresholds));

        setWaterLevel(floatVal.toFixed(2) + ' m');
        setAlertLevelKey(levelKey);

        if (CACHED_GUIDE && (CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'])) {
            const guide = CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'];
            setAlertLevelText(guide.title);

            let html = `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-gray-200 mt-4">`;

            if (guide.actions && guide.actions.length > 0) {
                guide.actions.forEach((act, index) => {
                    const stepNumber = String(index + 1).padStart(2, '0');
                    const partsEn = act.en.split(':');
                    const titleEn = partsEn.length > 1 ? partsEn[0] : `ACTION ${index + 1}`;
                    const descEn = partsEn.length > 1 ? partsEn.slice(1).join(':').trim() : act.en;

                    const partsTl = (act.tl || "").split(':');
                    const titleTl = partsTl.length > 1 ? partsTl[0] : '';
                    const descTl = partsTl.length > 1 ? partsTl.slice(1).join(':').trim() : act.tl;

                    // Choose diverse icons based on step index for better visual hierarchy
                    const icons = [
                        '<i class="fa-solid fa-bullhorn text-blue-400"></i>',
                        '<i class="fa-solid fa-shield-halved text-purple-400"></i>',
                        '<i class="fa-solid fa-person-running text-orange-500"></i>',
                        '<i class="fa-solid fa-kit-medical text-red-500"></i>',
                        '<i class="fa-solid fa-house-user text-green-400"></i>'
                    ];
                    let iconHtml = icons[index % icons.length];

                    html += `
                    <div class="flex flex-col border-l-2 border-gray-700 pl-3 sm:pl-4 bg-gray-800/20 p-3 rounded-lg min-w-0 break-words">
                        <div class="flex items-start gap-2 sm:space-x-3 mb-2 min-w-0">
                            <span class="text-2xl sm:text-3xl drop-shadow-lg shrink-0">${iconHtml}</span>
                            <div class="min-w-0">
                                <h3 class="text-base sm:text-lg font-bold tracking-wide sm:tracking-wider">${titleEn.toUpperCase()}</h3>
                                <p class="text-xs sm:text-sm font-semibold opacity-90">${descEn.toUpperCase()}</p>
                            </div>
                        </div>
                        <div class="mt-2 text-xs sm:text-sm text-gray-400 bg-black/20 p-2 rounded break-words">
                            <strong>${titleTl}</strong> ${descTl}
                        </div>
                    </div>`;
                });
            } else {
                html += `<div class="col-span-3 text-center text-gray-400 py-8"><i class="fa-solid fa-thumbs-up text-4xl mb-3 text-green-500 block"></i> No specific actions required at this time.</div>`;
            }
            html += `</div>`;
            setAlertHtml(html);
        } else {
            setAlertLevelText(`LEVEL: ${rawLevel}`);
        }
    };

    const loadCamera = async () => {
        try {
            // Prefer the latest persisted DB record so Render restarts still show image + level.
            const latest = await fetchLatestSensorReading();
            if (latest?.waterLevelM !== null && latest?.waterLevelM !== undefined) {
                processAlertData(latest.currentAlertLevel || alertLevelKey, latest.waterLevelM);
            }
            if (latest?.timestamp) {
                touchSensorTimestamp(latest.timestamp);
            }
            if (latest?.snapshotBase64 && latest.snapshotBase64 !== "") {
                applyCameraCaptureLabel(latest.timestamp);
                setCameraImg(`data:image/jpeg;base64,${latest.snapshotBase64}`);
                return;
            }

            // Fallback to existing camera endpoint if latest DB image is unavailable.
            const data = await fetchCameraFeed();
            if (data?.img_base64 && data.img_base64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${data.img_base64}`);
            }
        } catch (error) {
            console.error("Camera fetch failed", error);
        }
    };

    const loadWeather = async (silent = false) => {
        if (!silent) {
            setIsWeatherLoading(true);
            setWeatherError(null);
        }
        try {
            const primary = await fetchWeatherData(false);
            let data = primary;
            const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: DISPLAY_TIMEZONE });
            const hasToday = Array.isArray(primary?.daily?.time)
                && primary.daily.time.some((t) => String(t).startsWith(todayKey));

            if ((!hasToday || !primary?.daily?.time?.length) && primary?.daily?.time?.length) {
                try {
                    const refreshed = await fetchWeatherData(true);
                    if (refreshed?.daily?.time?.length) data = refreshed;
                } catch (refreshErr) {
                    console.warn('Weather refresh failed; using cached forecast.', refreshErr);
                }
            }

            const dayData = data?.daily;
            if (!dayData?.time?.length) {
                setWeatherCards([]);
                setWeatherError('No forecast data returned from the weather service.');
                return;
            }

            const cards = [];
            for (let i = 0; i < 5; i++) {
                if (!dayData.time[i]) continue;
                const dateObj = new Date(dayData.time[i]);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: DISPLAY_TIMEZONE });
                const tempMax = Math.round(dayData.apparent_temperature_max[i]);
                const tempMin = Math.round(dayData.apparent_temperature_min[i]);
                const weatherCode = dayData.weathercode[i];
                const info = getWeatherInfo(weatherCode);
                cards.push({ dayName, tempMax, tempMin, icon: info.icon, description: info.description });
            }
            setWeatherCards(cards);
            setWeatherError(cards.length === 0 ? 'No forecast data returned from the weather service.' : null);
        } catch (error) {
            console.error('Failed to fetch weather:', error);
            if (!silent) {
                setWeatherCards([]);
                setWeatherError(
                    error?.message
                    || 'Could not load weather forecast. Check that the backend is reachable and can reach Open-Meteo.'
                );
            }
        } finally {
            if (!silent) setIsWeatherLoading(false);
        }
    };

    const loadTides = async () => {
        setIsTidesLoading(true);
        try {
            // Prefer cached backend response first to avoid exhausting WorldTides credits.
            const primary = await fetchTidesData(false);
            let tideEvents = buildTideEvents(primary);
            const hasFutureHigh = tideEvents.some((event) => event.type === 'High' && (event.dt * 1000) > Date.now());
            const hasFutureLow = tideEvents.some((event) => event.type === 'Low' && (event.dt * 1000) > Date.now());

            if ((!hasFutureHigh || !hasFutureLow) && !primary?.error) {
                // Force-refresh only when the cached response lacks upcoming high/low events.
                const refreshed = await fetchTidesData(true);
                const refreshedEvents = buildTideEvents(refreshed);
                if (refreshedEvents.length > 0) tideEvents = refreshedEvents;
            }

            if (primary.error && tideEvents.length === 0) {
                setTidesError('Tide data is temporarily unavailable.');
                setTides([]);
            } else {
                setTidesError(null);
                setTides(tideEvents);
            }
        } catch (error) {
            console.error('Failed to fetch tide data:', error);
            setTidesError(error?.message || 'Could not load tide data.');
            setTides([]);
        } finally {
            setIsTidesLoading(false);
        }
    };

    useEffect(() => {
        if (!mqttData) return;
        touchSensorTimestamp(mqttData.timestamp);
        loadAlertStatus();
        if (mqttData.snapshotBase64 && mqttData.snapshotBase64 !== "") {
            applyCameraCaptureLabel(mqttData.timestamp);
            setCameraImg(`data:image/jpeg;base64,${mqttData.snapshotBase64}`);
        }
    }, [mqttData]);

    useEffect(() => {
        loadAlertStatus();
        loadWeather();
        loadTides();
        loadCamera();
        // Fetch thresholds from backend — no hardcoded numbers on the frontend
        fetchSystemThresholds().then(config => setSensorConfig(config));

        const weatherInterval = setInterval(() => {
            loadWeather(true);
            loadTides();
        }, 3600000);

        const statusInterval = setInterval(() => {
            loadAlertStatus();
            loadCamera();
        }, ALERT_STATUS_POLL_MS);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadAlertStatus();
                loadCamera();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(weatherInterval);
            clearInterval(statusInterval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);




    const colors = getAlertColors(alertLevelKey);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: DISPLAY_TIMEZONE });
    const today = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    const tideSummary = getCurrentTideSummary(tides);
    // Compute gauge markers fresh from fetched config — no hardcoded percentages
    const GAUGE_MARKS = gaugeMarkers(sensorConfig.thresholds, sensorConfig.sensorDepthM);
    const formatTideDate = (value) =>
        value ? new Date(value * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TIDE_DISPLAY_TIMEZONE }) : 'N/A';
    const formatTideTime = (value) =>
        value ? new Date(value * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TIDE_DISPLAY_TIMEZONE }) : 'N/A';

    return (
        <div id="home-view" className="min-h-screen bg-[#0f172a] text-gray-200 px-1 sm:px-0 lg:p-6 pb-28 sm:pb-24 max-w-[100vw] overflow-x-hidden">

            {/* TOP ROW: Gauges and Camera */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">

                {/* RIVER LEVEL GAUGE */}
                <div className={`lg:col-span-5 xl:col-span-6 rounded-2xl p-4 sm:p-6 border ${colors.border} ${colors.bg} ${colors.glow} flex flex-col justify-between overflow-hidden`}>
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">River Level Gauge</h2>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                {sensorAge.secondsAgo == null ? (
                                    'Sensor data as of: —'
                                ) : (
                                    <>
                                        Sensor data as of: {sensorAge.relative}
                                        <span className="hidden sm:inline"> · {sensorAge.absoluteClock} · {sensorAge.absoluteDate} (Manila)</span>
                                    </>
                                )}
                            </p>
                        </div>
                        <p className="text-[11px] font-medium text-gray-500 lg:hidden">Tap the gauge area below to jump to the Safety Action Guide.</p>
                    </div>

                    <div
                        className={`flex h-full w-full flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:gap-6 ${isCompactLayout ? 'cursor-pointer rounded-xl ring-0 transition active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400' : ''}`}
                        role={isCompactLayout ? 'button' : undefined}
                        tabIndex={isCompactLayout ? 0 : undefined}
                        aria-label={isCompactLayout ? 'Go to safety action guide' : undefined}
                        onClick={handleGaugeCardNavigate}
                        onKeyDown={(e) => {
                            if (!isCompactLayout) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                scrollToSafetyGuide();
                            }
                        }}
                    >
                        {/* Visual Thermometer */}
                        <div className="relative h-64 sm:h-80 w-48 flex-shrink-0 pb-4 sm:pb-0">
                            {/* The actual gauge */}
                            <div className="absolute bottom-0 left-0 h-full w-16 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden flex items-end shadow-inner">
                                {/* Gradient inner fill that moves up. Highly distinct colors. */}
                                <div className="w-full relative transition-all duration-1000 overflow-hidden" style={{ height: waterLevel !== '--.-- m' ? `${gaugeFillPercent(parseFloat(waterLevel), sensorConfig.sensorDepthM)}%` : '0%' }}>
                                    <div className="absolute bottom-0 w-full h-[320px]" style={{ background: `linear-gradient(to top, #22c55e 0%, #22c55e ${GAUGE_MARKS.yellow}%, #eab308 ${GAUGE_MARKS.yellow}%, #eab308 ${GAUGE_MARKS.orange}%, #ff8800 ${GAUGE_MARKS.orange}%, #ff8800 ${GAUGE_MARKS.red}%, #ff0000 ${GAUGE_MARKS.red}%, #ff0000 100%)` }}></div>
                                </div>
                            </div>

                            {/* Threshold Markers — positions driven by fetched config */}
                            <div className="absolute left-0 w-full h-[2px] bg-yellow-400 z-10 flex items-center" style={{ bottom: `${GAUGE_MARKS.yellow}%` }}>
                                <span className="absolute left-[4.25rem] sm:left-[70px] max-w-[calc(100%-4.5rem)] sm:max-w-none text-[10px] sm:text-xs font-bold text-yellow-400 sm:whitespace-nowrap bg-[#0f172a] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm border border-yellow-400/30 leading-tight">Yellow: Monitor</span>
                            </div>
                            <div className="absolute left-0 w-full h-[2px] bg-orange-500 z-10 flex items-center" style={{ bottom: `${GAUGE_MARKS.orange}%` }}>
                                <span className="absolute left-[4.25rem] sm:left-[70px] max-w-[calc(100%-4.5rem)] sm:max-w-none text-[10px] sm:text-xs font-bold text-[#ff8800] sm:whitespace-nowrap bg-[#0f172a] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm border border-orange-500/30 leading-tight">Orange: Prepare</span>
                            </div>
                            <div className="absolute left-0 w-full h-[2px] bg-red-600 z-10 flex items-center" style={{ bottom: `${GAUGE_MARKS.red}%` }}>
                                <span className="absolute left-[4.25rem] sm:left-[70px] max-w-[calc(100%-4.5rem)] sm:max-w-none text-[10px] sm:text-xs font-bold text-red-500 sm:whitespace-nowrap bg-[#0f172a] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm border border-red-600/30 leading-tight">Red: Evacuate</span>
                            </div>

                            {/* Current Water Level Pointer */}
                            {waterLevel !== '--.-- m' && (
                                <div className="absolute left-0 w-16 h-1.5 bg-white shadow-[0_0_15px_white] z-20 transition-all duration-1000" style={{ bottom: `${gaugeFillPercent(parseFloat(waterLevel), sensorConfig.sensorDepthM)}%` }}></div>
                            )}
                        </div>

                        <div className="flex-1 w-full min-w-0 flex flex-col justify-center">
                            <div className="text-center truncate w-full">
                                {waterLevel === '--.-- m' ? (
                                    <div className="w-32 h-16 bg-gray-700 rounded-lg animate-pulse mx-auto"></div>
                                ) : (
                                    <p className="text-6xl sm:text-7xl font-black tracking-tighter text-[#38bdf8] truncate">{waterLevel}</p>
                                )}
                                <div className={`mt-4 px-2 sm:px-4 py-2 rounded-md border text-center font-black font-mono tracking-wider shadow-lg text-sm sm:text-base truncate ${alertLevelKey === 'red' ? 'bg-red-900/60 border-red-500 text-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : alertLevelKey === 'orange' ? 'bg-orange-900/60 border-orange-500 text-[#ff8800] shadow-[0_0_15px_rgba(255,136,0,0.4)]' : alertLevelKey === 'yellow' ? 'bg-yellow-900/60 border-yellow-400 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-green-900/40 border-green-500 text-green-400'}`}>
                                    {alertLevelText}
                                </div>
                            </div>

                            {/* Baseline Legend Table — stop tap from jumping to safety guide */}
                            <div className="mt-8 w-full cursor-default overflow-x-auto rounded-lg border border-gray-700 bg-[#0f172a]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#1e293b] border-b border-gray-700 text-gray-300">
                                            <th className="py-2 px-3">Color</th>
                                            <th className="py-2 px-3">Status</th>
                                            <th className="py-2 px-3">Threshold</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-gray-800">
                                            <td className="py-2 px-3 font-bold text-green-500">Green</td>
                                            <td className="py-2 px-3 font-bold text-white">Normal</td>
                                            <td className="py-2 px-3 text-white">&lt; {sensorConfig.thresholds.yellow.toFixed(2)} m</td>
                                        </tr>
                                        <tr className="border-b border-gray-800">
                                            <td className="py-2 px-3 font-bold text-yellow-400">Yellow</td>
                                            <td className="py-2 px-3 font-bold text-white">Monitor</td>
                                            <td className="py-2 px-3 text-white">{sensorConfig.thresholds.yellow.toFixed(2)} – {sensorConfig.thresholds.orange.toFixed(2)} m</td>
                                        </tr>
                                        <tr className="border-b border-gray-800">
                                            <td className="py-2 px-3 font-bold text-orange-500">Orange</td>
                                            <td className="py-2 px-3 font-bold text-white">Prepare</td>
                                            <td className="py-2 px-3 text-white">{sensorConfig.thresholds.orange.toFixed(2)} – {sensorConfig.thresholds.red.toFixed(2)} m</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 font-bold text-red-500">Red</td>
                                            <td className="py-2 px-3 font-bold text-white">Evacuate</td>
                                            <td className="py-2 px-3 text-white">&gt; {sensorConfig.thresholds.red.toFixed(2)} m</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CAMERA FEED */}
                <div className="lg:col-span-7 xl:col-span-6 rounded-2xl p-4 sm:p-6 bg-[#1e293b] border border-gray-800 flex flex-col min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-4 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <h2 className="text-xs sm:text-sm font-bold text-slate-100 tracking-widest uppercase">Camera Feed</h2>
                            {cameraCaptureClock && (
                                <span className="text-xs font-bold text-cyan-400 hidden sm:inline ml-2">
                                    Captured: {cameraCaptureClock}
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-slate-300 flex items-center gap-2">
                            {cameraCaptureClock && (
                                <span className="text-xs font-bold text-cyan-400 sm:hidden mr-1">Captured: {cameraCaptureClock}</span>
                            )}
                            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span> Snapshot
                        </span>
                    </div>
                    <div className="w-full h-64 lg:h-80 bg-black rounded-xl overflow-hidden relative border border-gray-700 shadow-inner">
                        {cameraImg ? (
                            <img src={cameraImg} className="w-full h-full object-cover" alt="Camera Feed" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                <i className="fa-solid fa-camera mb-2 text-3xl opacity-50"></i>
                                <span>Camera feed currently unavailable</span>
                            </div>
                        )}
                        {liveManilaClock && (
                            <div className="absolute top-4 right-4 bg-black/80 text-cyan-400 text-sm font-black font-mono px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)] backdrop-blur-md z-10 text-right leading-tight">
                                <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Live (Manila)</span>
                                {liveManilaClock}
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded backdrop-blur-sm text-sm font-bold text-white uppercase tracking-tighter">TULLAHAN STATION</div>
                    </div>
                </div>

            </div>

            {/* MIDDLE ROW: ACTIONS CHECKLIST */}
            <div id="safety-action-guide" className={`scroll-mt-24 rounded-2xl border-2 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 sm:p-6 mb-6 min-w-0 ${colors.border} ${colors.glow}`}>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-100 sm:mb-4 sm:text-sm">Safety Action Guide</h2>
                <div className={`w-full py-2.5 sm:py-3 px-2 text-center rounded-lg font-black text-base sm:text-xl tracking-wide sm:tracking-wider uppercase mb-4 sm:mb-6 shadow-md break-words ${alertLevelKey === 'red' ? 'bg-red-600 text-white' : alertLevelKey === 'orange' ? 'bg-orange-500 text-white' : alertLevelKey === 'yellow' ? 'bg-yellow-400 text-gray-900' : 'bg-green-500 text-white'}`}>
                    {alertLevelText}
                </div>
                <div dangerouslySetInnerHTML={{ __html: alertHtml }}></div>
            </div>

            {/* BOTTOM ROW: TIDES & WEATHER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* TIDE SUMMARY */}
                <div className="rounded-2xl p-4 sm:p-6 bg-[#1e293b] border border-gray-800 flex flex-col min-w-0">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-100 tracking-widest mb-4 uppercase">Tide Status</h2>
                    <div className="flex-1 flex flex-col justify-center">
                        {tidesError ? (
                            <div className="bg-gray-800 text-slate-200 p-4 rounded-xl text-center border border-gray-700">
                                ℹ️ {tidesError}
                            </div>
                        ) : isTidesLoading ? (
                            <div className="space-y-4">
                                <div className="h-6 bg-gray-800 rounded animate-pulse w-3/4 mx-auto"></div>
                                <div className="h-6 bg-gray-800 rounded animate-pulse w-1/2 mx-auto"></div>
                            </div>
                        ) : tides.length === 0 ? (
                            <div className="text-center text-gray-500">No tide data available for today.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center">
                                    <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Tide</span>
                                    <div className="flex items-center gap-2">
                                        <i className={`fa-solid ${tideSummary.status === 'High Tide' || tideSummary.status === 'Rising' ? 'fa-arrow-up text-red-500' : tideSummary.status === 'Low Tide' || tideSummary.status === 'Falling' ? 'fa-arrow-down text-blue-400' : 'fa-wave-square text-cyan-300'}`}></i>
                                        <span className={`text-lg sm:text-2xl font-black text-center break-words ${tideSummary.status === 'High Tide' || tideSummary.status === 'Rising' ? 'text-red-500' : tideSummary.status === 'Low Tide' || tideSummary.status === 'Falling' ? 'text-blue-400' : 'text-cyan-300'}`}>{tideSummary.status}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-gray-700/50 flex flex-col justify-between min-w-0">
                                        <div>
                                            <span className="text-xs text-gray-400 uppercase tracking-wider">Next High Tide</span>
                                            <div className="text-[10px] text-gray-500 mt-0.5">{formatTideDate(tideSummary.nextHigh?.dt)}</div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <i className="fa-solid fa-arrow-up text-red-500"></i>
                                            <p className="text-lg font-bold text-red-400">
                                                {tideSummary.nextHigh
                                                    ? formatTideTime(tideSummary.nextHigh.dt)
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-gray-700/50 flex flex-col justify-between min-w-0">
                                        <div>
                                            <span className="text-xs text-gray-400 uppercase tracking-wider">Next Low Tide</span>
                                            <div className="text-[10px] text-gray-500 mt-0.5">{formatTideDate(tideSummary.nextLow?.dt)}</div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <i className="fa-solid fa-arrow-down text-blue-400"></i>
                                            <p className="text-lg font-bold text-blue-300">
                                                {tideSummary.nextLow
                                                    ? formatTideTime(tideSummary.nextLow.dt)
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* WEATHER FORECAST */}
                <div className="rounded-2xl p-4 sm:p-6 bg-[#1e293b] border border-gray-800 flex flex-col justify-between min-w-0">
                    <div className="min-w-0">
                        <h2 className="text-xs sm:text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Weather Forecast</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 text-center items-stretch">
                            {isWeatherLoading ? (
                                <p className="col-span-full text-gray-500">Loading Weather Data...</p>
                            ) : weatherError ? (
                                <p className="col-span-full text-amber-200/90 text-sm">{weatherError}</p>
                            ) : weatherCards.length === 0 ? (
                                <p className="col-span-full text-gray-500">No weather data available.</p>
                            ) : (
                                weatherCards.map((card, i) => (
                                    <div key={i} className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl hover:bg-gray-800 transition-colors min-w-0">
                                        <p className="font-bold text-cyan-400 text-xs sm:text-sm mb-1 sm:mb-2">{card.dayName}</p>
                                        <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 drop-shadow-lg">{card.icon}</div>
                                        <p className="text-[10px] sm:text-xs text-gray-400 leading-tight mb-2 min-h-[2.5rem] sm:min-h-[2rem] flex items-center justify-center px-0.5">{card.description}</p>
                                        <div className="flex flex-col items-center gap-0.5 text-xs font-mono text-gray-300">
                                            <span><span className="text-red-400">H:</span> {card.tempMax}°C</span>
                                            <span><span className="text-blue-400">L:</span> {card.tempMin}°C</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="mt-4 text-[10px] sm:text-xs font-bold text-gray-300 text-center border-t border-gray-700 pt-3 pb-1">
                        <i className="fa-solid fa-circle-info mr-1 text-cyan-400"></i> Temperatures reflect the Heat Index ("Feels Like"). <span className="text-red-400">H</span> = Maximum, <span className="text-blue-400">L</span> = Minimum.
                    </div>
                </div>
            </div>

            {/* COLLAPSIBLE SIDEWAYS FLOATING ACTION BUTTONS */}
            <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex items-end justify-end max-w-[calc(100vw-1rem)]">
                <div className={`flex flex-col items-end gap-2 sm:gap-3 transition-all duration-500 ease-in-out overflow-hidden ${isFabOpen ? 'max-w-[min(20rem,calc(100vw-4rem))] sm:max-w-[28rem] opacity-100 mr-2 sm:mr-3' : 'max-w-0 opacity-0 mr-0'}`}>
                    <button onClick={() => navigate('/maps')} className="bg-[#22d3ee] hover:bg-[#06b6d4] text-[#083344] font-bold text-xs sm:text-sm tracking-wide py-2.5 sm:py-3 px-4 sm:px-5 rounded-full shadow-[0_4px_10px_rgba(34,211,238,0.3)] transform transition hover:-translate-y-1 flex items-center justify-center gap-2 border border-[#67e8f9] flex-shrink-0 w-full text-center whitespace-normal sm:whitespace-nowrap">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Evacuation Site
                    </button>
                    <button onClick={() => navigate('/register')} className="bg-[#a3e635] hover:bg-[#84cc16] text-[#1a2e05] font-bold text-xs sm:text-sm tracking-wide py-2.5 sm:py-3 px-4 sm:px-5 rounded-full shadow-[0_4px_10px_rgba(163,230,53,0.3)] transform transition hover:-translate-y-1 flex items-center justify-center gap-2 border border-[#bef264] flex-shrink-0 w-full text-center whitespace-normal sm:whitespace-nowrap">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                        Subscribe to SMS Alert
                    </button>
                </div>
                <button
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center transform transition active:scale-95 border-2 border-cyan-400 flex-shrink-0 z-50 self-end"
                >
                    <i className={`fa-solid ${isFabOpen ? 'fa-chevron-right text-xl' : 'fa-chevron-left text-xl'} drop-shadow-md`}></i>
                </button>
            </div>

        </div>
    );
}
