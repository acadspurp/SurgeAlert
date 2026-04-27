import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlertStatus, fetchAlertGuide, fetchCameraFeed, fetchWeatherData, fetchTidesData, getWeatherInfo } from '../services/api.js';
import { useSensorMqtt } from '../hooks/useSensorMqtt.js';

let CACHED_GUIDE = null;

function getAlertColors(levelKey) {
    if (levelKey === 'green') return { bg: 'bg-[#1e293b]', border: 'border-green-500', text: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.3)]' };
    if (levelKey === 'yellow') return { bg: 'bg-[#1e293b]', border: 'border-yellow-400', text: 'text-yellow-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]' };
    if (levelKey === 'orange') return { bg: 'bg-[#1e293b]', border: 'border-orange-500', text: 'text-orange-500', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]' };
    if (levelKey === 'red') return { bg: 'bg-[#1e293b]', border: 'border-red-600', text: 'text-red-500', glow: 'shadow-[0_0_15px_rgba(220,38,38,0.4)]' };
    return { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-400', glow: '' };
}

export default function Home() {
    const navigate = useNavigate();
    const mqttData = useSensorMqtt();

    // State
    const [waterLevel, setWaterLevel] = useState('--.-- m');
    const [alertLevelText, setAlertLevelText] = useState('LOADING...');
    const [alertLevelKey, setAlertLevelKey] = useState('green');
    const [alertHtml, setAlertHtml] = useState('<p class="text-gray-400">System is running normally.</p>');
    const [cameraImg, setCameraImg] = useState(null);
    const [cameraLastUpdated, setCameraLastUpdated] = useState(null);
    const [weatherCards, setWeatherCards] = useState([]);
    const [tides, setTides] = useState([]);
    const [tidesError, setTidesError] = useState(null);
    const [isTidesLoading, setIsTidesLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    const getCurrentTideSummary = (events) => {
        if (!Array.isArray(events) || events.length === 0) return { status: 'Normal', nextHigh: null, nextLow: null };
        const now = new Date();
        const sorted = [...events].sort((a, b) => a.dt - b.dt);
        const previous = [...sorted].reverse().find(t => new Date(t.dt * 1000) <= now);
        const upcoming = sorted.filter(t => new Date(t.dt * 1000) > now);
        const nextHigh = upcoming.find(t => String(t.type).toLowerCase() === 'high') || null;
        const nextLow = upcoming.find(t => String(t.type).toLowerCase() === 'low') || null;

        let status = 'Normal';
        if (previous) {
            const h = previous.height ?? 0;
            if (String(previous.type).toLowerCase() === 'high' || h >= 1.8) status = 'High Tide';
            else if (String(previous.type).toLowerCase() === 'low' || h <= 0.8) status = 'Low Tide';
        }
        return { status, nextHigh, nextLow };
    };

    // Data fetching functions
    const loadAlertStatus = async () => {
        try {
            if (!CACHED_GUIDE) CACHED_GUIDE = await fetchAlertGuide();
            const data = await fetchAlertStatus();
            const isOverride = data.description && data.description.includes('OVERRIDE');
            processAlertData(data.alertLevel, data.waterLevelM, isOverride);
        } catch (error) {
            console.error("Failed to fetch status:", error);
        }
    };

    const processAlertData = (rawLevel, currentLevel, isOverride = false) => {
        if (rawLevel === 'OFFLINE' || currentLevel === null) {
            setIsOffline(true);
            return;
        }

        setIsOffline(false);
        const floatVal = parseFloat(currentLevel);
        
        // Priority 1: Admin Override. Priority 2: Pure Mathematical Float Calculation vs Ghost Data.
        const levelKey = isOverride 
            ? rawLevel.toLowerCase() 
            : (floatVal >= 8.5 ? 'red' : floatVal >= 7.0 ? 'orange' : floatVal >= 6.0 ? 'yellow' : 'green');

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
                    <div class="flex flex-col border-l-2 border-gray-700 pl-4 bg-gray-800/20 p-3 rounded-lg">
                        <div class="flex items-center space-x-3 mb-2">
                            <span class="text-3xl drop-shadow-lg">${iconHtml}</span>
                            <div>
                                <h3 class="text-lg font-bold tracking-wider">${titleEn.toUpperCase()}</h3>
                                <p class="text-sm font-semibold opacity-90">${descEn.toUpperCase()}</p>
                            </div>
                        </div>
                        <div class="mt-2 text-sm text-gray-400 bg-black/20 p-2 rounded">
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
            const data = await fetchCameraFeed();
            if (data.img_base64 && data.img_base64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${data.img_base64}`);
                setCameraLastUpdated(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error("Camera fetch failed", error);
        }
    };

    const loadWeather = async () => {
        try {
            const data = await fetchWeatherData();
            const dayData = data.daily;
            const cards = [];
            for (let i = 0; i < 5; i++) {
                if (!dayData.time[i]) continue;
                const dateObj = new Date(dayData.time[i]);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const tempMax = Math.round(dayData.apparent_temperature_max[i]);
                const tempMin = Math.round(dayData.apparent_temperature_min[i]);
                const weatherCode = dayData.weathercode[i];
                const info = getWeatherInfo(weatherCode);
                cards.push({ dayName, tempMax, tempMin, icon: info.icon, description: info.description });
            }
            setWeatherCards(cards);
        } catch (error) {
            console.error('Failed to fetch weather:', error);
            setWeatherCards([]);
        }
    };

    const loadTides = async () => {
        setIsTidesLoading(true);
        try {
            const data = await fetchTidesData();
            if (data.error) {
                setTidesError('Tide data is temporarily unavailable.');
                setTides([]);
            } else {
                setTidesError(null);
                setTides(data.extremes || []);
            }
        } catch (error) {
            console.error('Failed to fetch tide data:', error);
            setTidesError('Could not load tide data.');
            setTides([]);
        } finally {
            setIsTidesLoading(false);
        }
    };

    useEffect(() => {
        if (mqttData) {
            processAlertData(mqttData.currentAlertLevel || 'green', mqttData.waterLevelM);
            if (mqttData.snapshotBase64 && mqttData.snapshotBase64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${mqttData.snapshotBase64}`);
                setCameraLastUpdated(new Date().toLocaleTimeString());
            }
        }
    }, [mqttData]);

    useEffect(() => {
        loadAlertStatus();
        loadWeather();
        loadTides();
        loadCamera();

        const weatherInterval = setInterval(() => {
            loadWeather();
            loadTides();
        }, 3600000);

        return () => clearInterval(weatherInterval);
    }, []);

    // Auto-Simulate for local testing if API is offline or data is corrupt
    useEffect(() => {
        let simInterval = null;
        let isSimulating = false;

        const checkSimulation = () => {
             const level = mqttData ? mqttData.waterLevelM : parseFloat(waterLevel);
             if (isOffline || isNaN(level)) {
                 isSimulating = true;
             }
        };
        checkSimulation();

        if (isSimulating) {
            let fakeLevel = isNaN(parseFloat(waterLevel)) ? 5.8 : parseFloat(waterLevel);
            const tick = () => {
                const randomDrift = (Math.random() * 2) - 0.5; // push it up steadily
                fakeLevel = Math.min(10.0, Math.max(0.0, fakeLevel + randomDrift));
                const levelKey = fakeLevel >= 8.5 ? 'red' : fakeLevel >= 7.0 ? 'orange' : fakeLevel >= 6.0 ? 'yellow' : 'green';
                setWaterLevel(fakeLevel.toFixed(2) + ' m');
                setAlertLevelKey(levelKey);
                
                // Add fake camera timestamp so "Last updated: [Time]" is always visible in demo
                setCameraLastUpdated(new Date().toLocaleTimeString());
                
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

                            const icons = [
                                '<i class="fa-solid fa-bullhorn text-blue-400"></i>',
                                '<i class="fa-solid fa-shield-halved text-purple-400"></i>',
                                '<i class="fa-solid fa-person-running text-orange-500"></i>',
                                '<i class="fa-solid fa-kit-medical text-red-500"></i>',
                                '<i class="fa-solid fa-house-user text-green-400"></i>'
                            ];
                            let iconHtml = icons[index % icons.length];

                            html += `
                            <div class="flex flex-col border-l-2 border-gray-700 pl-4 bg-gray-800/20 p-3 rounded-lg">
                                <div class="flex items-center space-x-3 mb-2">
                                    <span class="text-3xl drop-shadow-lg">${iconHtml}</span>
                                    <div>
                                        <h3 class="text-lg font-bold tracking-wider">${titleEn.toUpperCase()}</h3>
                                        <p class="text-sm font-semibold opacity-90">${descEn.toUpperCase()}</p>
                                    </div>
                                </div>
                                <div class="mt-2 text-sm text-gray-400 bg-black/20 p-2 rounded">
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
                    setAlertLevelText(`LEVEL: ${levelKey.toUpperCase()}`);
                }
            };
            tick();
            simInterval = setInterval(tick, 15000);
        }

        return () => clearInterval(simInterval);
    }, [isOffline, mqttData]);



    const colors = getAlertColors(alertLevelKey);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const today = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    const tideSummary = getCurrentTideSummary(tides);
    const formatTideDate = (value) =>
        value ? new Date(value * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
    const formatTideTime = (value) =>
        value ? new Date(value * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';

    return (
        <div id="home-view" className="min-h-screen bg-[#0f172a] text-gray-200 lg:p-6 pb-24">
            
            {/* TOP ROW: Gauges and Camera */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                
                {/* RIVER LEVEL GAUGE */}
                <div className={`lg:col-span-5 xl:col-span-6 rounded-2xl p-6 border ${colors.border} ${colors.bg} ${colors.glow} flex flex-col justify-between overflow-hidden`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase">River Level Gauge</h2>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 sm:gap-6 h-full w-full">
                         {/* Visual Thermometer */}
                        <div className="relative h-64 sm:h-80 w-48 flex-shrink-0 pb-4 sm:pb-0">
                             {/* The actual gauge */}
                             <div className="absolute bottom-0 left-0 h-full w-16 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden flex items-end shadow-inner">
                                 {/* Gradient inner fill that moves up. Highly distinct colors. */}
                                 <div className="w-full relative transition-all duration-1000 overflow-hidden" style={{ height: waterLevel !== '--.-- m' ? `${Math.min(100, (parseFloat(waterLevel) / 10) * 100)}%` : '0%' }}>
                                    <div className="absolute bottom-0 w-full h-[320px]" style={{ background: 'linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 70%, #ff8800 70%, #ff8800 85%, #ff0000 85%, #ff0000 100%)' }}></div>
                                 </div>
                             </div>

                             {/* Threshold Markers with Lines and Labels */}
                             <div className="absolute bottom-[60%] left-0 w-full h-[2px] bg-yellow-400 z-10 flex items-center">
                                <span className="absolute left-[70px] text-xs font-bold text-yellow-400 whitespace-nowrap bg-[#0f172a] px-2 py-1 rounded shadow-sm border border-yellow-400/30">Yellow: Monitor</span>
                             </div>
                             <div className="absolute bottom-[70%] left-0 w-full h-[2px] bg-orange-500 z-10 flex items-center">
                                <span className="absolute left-[70px] text-xs font-bold text-[#ff8800] whitespace-nowrap bg-[#0f172a] px-2 py-1 rounded shadow-sm border border-orange-500/30">Orange: Prepare</span>
                             </div>
                             <div className="absolute bottom-[85%] left-0 w-full h-[2px] bg-red-600 z-10 flex items-center">
                                <span className="absolute left-[70px] text-xs font-bold text-red-500 whitespace-nowrap bg-[#0f172a] px-2 py-1 rounded shadow-sm border border-red-600/30">Red: Evacuate</span>
                             </div>
                             
                             {/* Current Water Level Pointer */}
                             {waterLevel !== '--.-- m' && (
                                <div className="absolute left-0 w-16 h-1.5 bg-white shadow-[0_0_15px_white] z-20 transition-all duration-1000" style={{ bottom: `${Math.min(100, (parseFloat(waterLevel) / 10) * 100)}%` }}></div>
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
                            
                            {/* Baseline Legend Table */}
                            <div className="mt-8 bg-[#0f172a] rounded-lg border border-gray-700 overflow-x-auto w-full">
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
                                            <td className="py-2 px-3 text-gray-400">&lt; 6.0 m</td>
                                        </tr>
                                        <tr className="border-b border-gray-800">
                                            <td className="py-2 px-3 font-bold text-yellow-400">Yellow</td>
                                            <td className="py-2 px-3 font-bold text-white">Monitor</td>
                                            <td className="py-2 px-3 text-gray-400">6.0 - 7.0 m</td>
                                        </tr>
                                        <tr className="border-b border-gray-800">
                                            <td className="py-2 px-3 font-bold text-orange-500">Orange</td>
                                            <td className="py-2 px-3 font-bold text-white">Prepare</td>
                                            <td className="py-2 px-3 text-gray-400">7.0 - 8.5 m</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-3 font-bold text-red-500">Red</td>
                                            <td className="py-2 px-3 font-bold text-white">Evacuate</td>
                                            <td className="py-2 px-3 text-gray-400">&gt; 8.5 m</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CAMERA FEED */}
                <div className="lg:col-span-7 xl:col-span-6 rounded-2xl p-6 bg-[#1e293b] border border-gray-800 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase">Camera Feed</h2>
                            {cameraLastUpdated && <span className="text-[10px] text-gray-500 hidden sm:inline">(Last updated: {cameraLastUpdated})</span>}
                        </div>
                        <span className="text-xs text-gray-500 flex items-center gap-2">
                            {cameraLastUpdated && <span className="text-[10px] sm:hidden mr-1">Updated: {cameraLastUpdated}</span>}
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
                        {cameraLastUpdated && (
                            <div className="absolute top-4 right-4 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded backdrop-blur-sm z-10">
                                {cameraLastUpdated}
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded backdrop-blur-sm text-sm font-bold text-white">TULLAHAN STATION</div>
                    </div>
                </div>

            </div>

            {/* MIDDLE ROW: ACTIONS CHECKLIST */}
            <div className={`rounded-2xl p-6 mb-6 border-2 bg-gradient-to-br from-[#1e293b] to-[#0f172a] ${colors.border} ${colors.glow}`}>
                <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Safety Action Guide</h2>
                <div className={`w-full py-3 text-center rounded-lg font-black text-xl tracking-wider uppercase mb-6 shadow-md ${alertLevelKey === 'red' ? 'bg-red-600 text-white' : alertLevelKey === 'orange' ? 'bg-orange-500 text-white' : alertLevelKey === 'yellow' ? 'bg-yellow-400 text-gray-900' : 'bg-green-500 text-white'}`}>
                    {alertLevelText}
                </div>
                <div dangerouslySetInnerHTML={{ __html: alertHtml }}></div>
            </div>

            {/* BOTTOM ROW: TIDES & WEATHER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* TIDE SUMMARY */}
                <div className="rounded-2xl p-6 bg-[#1e293b] border border-gray-800 flex flex-col">
                    <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Tide Status</h2>
                    <div className="flex-1 flex flex-col justify-center">
                        {tidesError ? (
                            <div className="bg-gray-800 text-gray-400 p-4 rounded-xl text-center border border-gray-700">
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
                                        <i className={`fa-solid ${tideSummary.status === 'High Tide' ? 'fa-arrow-up text-red-500' : tideSummary.status === 'Low Tide' ? 'fa-arrow-down text-blue-400' : 'fa-wave-square text-cyan-300'}`}></i>
                                        <span className={`text-2xl font-black ${tideSummary.status === 'High Tide' ? 'text-red-500' : tideSummary.status === 'Low Tide' ? 'text-blue-400' : 'text-cyan-300'}`}>{tideSummary.status}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col justify-between">
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
                                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col justify-between">
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
                <div className="rounded-2xl p-6 bg-[#1e293b] border border-gray-800 flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Weather Forecast</h2>
                        <div className="grid grid-cols-5 gap-2 text-center items-center">
                        {weatherCards.length === 0 ? (
                            <p className="col-span-full text-gray-500">Loading Weather Data...</p>
                        ) : (
                            weatherCards.map((card, i) => (
                                <div key={i} className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-gray-800 transition-colors">
                                    <p className="font-bold text-cyan-400 text-sm mb-2">{card.dayName}</p>
                                    <div className="text-3xl mb-2 drop-shadow-lg">{card.icon}</div>
                                    <p className="text-xs text-gray-400 leading-tight mb-2 h-8 flex items-center justify-center">{card.description}</p>
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
            <div className="fixed bottom-6 right-6 z-50 flex items-center justify-end">
                <div className={`flex flex-col items-end gap-3 transition-all duration-500 ease-in-out whitespace-nowrap overflow-hidden ${isFabOpen ? 'max-w-[800px] opacity-100 mr-3' : 'max-w-0 opacity-0 mr-0'}`}>
                    <button onClick={() => navigate('/maps')} className="bg-[#22d3ee] hover:bg-[#06b6d4] text-[#083344] font-bold text-xs sm:text-sm tracking-wide py-3 px-5 rounded-full shadow-[0_4px_10px_rgba(34,211,238,0.3)] transform transition hover:-translate-y-1 flex items-center justify-center gap-2 border border-[#67e8f9] flex-shrink-0 w-full sm:w-auto">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Evacuation Site
                    </button>
                    <button onClick={() => navigate('/register')} className="bg-[#a3e635] hover:bg-[#84cc16] text-[#1a2e05] font-bold text-xs sm:text-sm tracking-wide py-3 px-5 rounded-full shadow-[0_4px_10px_rgba(163,230,53,0.3)] transform transition hover:-translate-y-1 flex items-center justify-center gap-2 border border-[#bef264] flex-shrink-0 w-full sm:w-auto">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                        SMS Alert
                    </button>
                </div>
                <button 
                    onClick={() => setIsFabOpen(!isFabOpen)} 
                    className="bg-cyan-600 hover:bg-cyan-500 text-white w-14 h-14 rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center transform transition active:scale-95 border-2 border-cyan-400 flex-shrink-0 z-50 self-end"
                >
                    <i className={`fa-solid ${isFabOpen ? 'fa-chevron-right text-xl' : 'fa-chevron-left text-xl'} drop-shadow-md`}></i>
                </button>
            </div>

        </div>
    );
}
