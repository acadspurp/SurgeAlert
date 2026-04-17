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
    const [weatherCards, setWeatherCards] = useState([]);
    const [tides, setTides] = useState([]);
    const [tidesError, setTidesError] = useState(null);
    const [isTidesLoading, setIsTidesLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    // Data fetching functions
    const loadAlertStatus = async () => {
        try {
            if (!CACHED_GUIDE) CACHED_GUIDE = await fetchAlertGuide();
            const data = await fetchAlertStatus();
            processAlertData(data.alertLevel, data.waterLevelM);
        } catch (error) {
            console.error("Failed to fetch status:", error);
        }
    };

    const processAlertData = (rawLevel, currentLevel) => {
        if (rawLevel === 'OFFLINE' || currentLevel === null) {
            setWaterLevel('--.-- m');
            setAlertLevelText('SENSOR OFFLINE');
            setAlertLevelKey('offline');
            setIsOffline(true);
            return;
        }

        setIsOffline(false);
        const levelKey = rawLevel.toLowerCase();
        setWaterLevel(currentLevel.toFixed(2) + ' m');
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
                const tempMax = Math.round(dayData.temperature_2m_max[i]);
                const tempMin = Math.round(dayData.temperature_2m_min[i]);
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

    const colors = getAlertColors(alertLevelKey);
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div id="home-view" className="min-h-screen bg-[#0f172a] text-gray-200 lg:p-6 pb-24">
            
            {/* TOP ROW: Gauges and Camera */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                
                {/* RIVER LEVEL GAUGE */}
                <div className={`lg:col-span-2 rounded-2xl p-6 border ${colors.border} ${colors.bg} ${colors.glow} flex flex-col justify-between`}>
                    <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">River Level Gauge</h2>
                    <div className="flex items-center justify-between h-full">
                         {/* Visual Thermometer */}
                        <div className="relative h-48 w-12 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden flex-shrink-0 flex items-end">
                             {/* Gradient inner fill that moves up. Highly distinct colors. */}
                             <div className="w-full relative transition-all duration-1000 overflow-hidden" style={{ height: waterLevel !== '--.-- m' ? `${Math.min(100, (parseFloat(waterLevel) / 10) * 100)}%` : '0%' }}>
                                <div className="absolute bottom-0 w-full h-48" style={{ background: 'linear-gradient(to top, #22c55e 0%, #22c55e 55%, #eab308 55%, #eab308 70%, #ff8800 70%, #ff8800 85%, #ff0000 85%, #ff0000 100%)' }}></div>
                             </div>

                             {/* Threshold Markers */}
                             <div className="absolute bottom-[60%] left-0 w-full border-t-2 border-yellow-400/80 z-10" title="6m - Yellow"></div>
                             <div className="absolute bottom-[70%] left-0 w-full border-t-2 border-orange-500/80 z-10" title="7m - Orange"></div>
                             <div className="absolute bottom-[85%] left-0 w-full border-t-2 border-red-500/80 z-10" title="8.5m - Red"></div>
                             
                             {/* Current Water Level Pointer */}
                             {waterLevel !== '--.-- m' && (
                                <div className="absolute left-0 w-full h-1 bg-white shadow-[0_0_12px_white] z-20 transition-all duration-1000" style={{ bottom: `${Math.min(100, (parseFloat(waterLevel) / 10) * 100)}%` }}></div>
                             )}
                        </div>
                        
                        <div className="flex-1 ml-6 flex flex-col justify-center">
                            <div className="text-center">
                                {waterLevel === '--.-- m' ? (
                                    <div className="w-32 h-16 bg-gray-700 rounded-lg animate-pulse mx-auto"></div>
                                ) : (
                                    <p className="text-6xl font-black tracking-tighter text-[#38bdf8]">{waterLevel}</p>
                                )}
                                <div className={`mt-4 px-4 py-2 rounded-md border text-center font-black font-mono tracking-wider ${alertLevelKey === 'red' ? 'bg-red-900/60 border-red-500 text-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : alertLevelKey === 'orange' ? 'bg-orange-900/60 border-orange-500 text-[#ff8800] shadow-[0_0_15px_rgba(255,136,0,0.4)]' : alertLevelKey === 'yellow' ? 'bg-yellow-900/60 border-yellow-400 text-yellow-400' : 'bg-green-900/40 border-green-500 text-green-400'}`}>
                                    {alertLevelText}
                                </div>
                            </div>
                            
                            {/* Baseline Legend */}
                            <div className="mt-4 bg-gray-900/50 rounded-lg p-2 border border-gray-700 text-xs font-mono grid grid-cols-2 gap-1 text-center">
                                <span className="text-green-400 font-bold border-b border-gray-600 pb-1">Normal</span><span className="text-gray-400 border-b border-gray-600 pb-1">&lt; 6.0 m</span>
                                <span className="text-yellow-400 font-bold border-b border-gray-600 pb-1">Yellow</span><span className="text-gray-400 border-b border-gray-600 pb-1">6.0 - 7.0 m</span>
                                <span className="text-[#ff8800] font-bold border-b border-gray-600 pb-1">Orange</span><span className="text-gray-400 border-b border-gray-600 pb-1">7.0 - 8.5 m</span>
                                <span className="text-[#ff0000] font-black">Red Alert</span><span className="text-gray-400">&gt; 8.5 m</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LIVE CAMERA FEED */}
                <div className="lg:col-span-3 rounded-2xl p-6 bg-[#1e293b] border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-bold text-gray-400 tracking-widest uppercase">Live Camera Feed</h2>
                        <span className="text-xs text-gray-500 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Live</span>
                    </div>
                    <div className="w-full h-64 lg:h-80 bg-black rounded-xl overflow-hidden relative border border-gray-700 shadow-inner">
                        {cameraImg ? (
                            <img src={cameraImg} className="w-full h-full object-cover" alt="Live River Feed" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                <i className="fa-solid fa-video mb-2 text-3xl opacity-50"></i>
                                <span>Waiting for Camera Feed...</span>
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded backdrop-blur-sm text-sm font-bold text-white">TULLAHAN STATION</div>
                    </div>
                </div>

            </div>

            {/* MIDDLE ROW: ACTIONS CHECKLIST */}
            <div className={`rounded-2xl p-6 mb-6 border-2 bg-gradient-to-br from-[#1e293b] to-[#0f172a] ${colors.border} ${colors.glow}`}>
                <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Action Directive Checklist</h2>
                <div className={`w-full py-3 text-center rounded-lg font-black text-xl tracking-wider uppercase mb-6 shadow-md ${alertLevelKey === 'red' ? 'bg-red-600 text-white' : alertLevelKey === 'orange' ? 'bg-orange-500 text-white' : alertLevelKey === 'yellow' ? 'bg-yellow-400 text-gray-900' : 'bg-green-500 text-white'}`}>
                    {alertLevelText}
                </div>
                <div dangerouslySetInnerHTML={{ __html: alertHtml }}></div>
            </div>

            {/* BOTTOM ROW: TIDES & WEATHER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* TIDE PREDICTIONS */}
                <div className="rounded-2xl p-6 bg-[#1e293b] border border-gray-800 flex flex-col">
                    <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Tide Predictions <span className="text-gray-600 font-normal lowercase ml-2">({today})</span></h2>
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
                            <div className="grid grid-cols-2 gap-4">
                                {tides.map((tide, i) => {
                                    const tideTime = new Date(tide.dt * 1000);
                                    const timeString = tideTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                    const isHigh = tide.type === 'High';
                                    return (
                                        <div key={i} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center">
                                            <span className={`text-sm font-bold uppercase tracking-widest mb-1 ${isHigh ? 'text-blue-400' : 'text-cyan-600'}`}>{isHigh ? 'High Tide' : 'Low Tide'}</span>
                                            <span className="text-xl font-mono text-gray-200">{timeString}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* WEATHER FORECAST */}
                <div className="rounded-2xl p-6 bg-[#1e293b] border border-gray-800">
                    <h2 className="text-sm font-bold text-gray-400 tracking-widest mb-4 uppercase">Weather Forecast</h2>
                    <div className="grid grid-cols-5 gap-2 text-center h-full items-center">
                        {weatherCards.length === 0 ? (
                            <p className="col-span-full text-gray-500">Loading Weather Data...</p>
                        ) : (
                            weatherCards.map((card, i) => (
                                <div key={i} className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-gray-800 transition-colors">
                                    <p className="font-bold text-cyan-400 text-sm mb-2">{card.dayName}</p>
                                    <div className="text-3xl mb-2 drop-shadow-lg">{card.icon}</div>
                                    <p className="text-xs text-gray-400 leading-tight mb-2 h-8 flex items-center justify-center">{card.description}</p>
                                    <p className="text-xs font-mono text-gray-300">{card.tempMax}° / {card.tempMin}°</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* FLOATING ACTION BUTTONS */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
                <button onClick={() => navigate('/maps')} className="bg-[#22d3ee] hover:bg-[#06b6d4] text-[#083344] font-black tracking-wide py-3 px-6 rounded-full shadow-[0_10px_20px_rgba(34,211,238,0.3)] transform transition hover:-translate-y-1 flex items-center justify-center gap-2 border border-[#67e8f9]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    Nearest Evacuation Site
                </button>
                <button onClick={() => navigate('/register')} className="bg-[#a3e635] hover:bg-[#84cc16] text-[#1a2e05] font-black tracking-wide py-3 px-6 rounded-full shadow-[0_10px_20px_rgba(163,230,53,0.3)] transform transition hover:-translate-y-1 flex items-center justify-center gap-2 border border-[#bef264]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                    Subscribe for SMS Alert
                </button>
            </div>

        </div>
    );
}
