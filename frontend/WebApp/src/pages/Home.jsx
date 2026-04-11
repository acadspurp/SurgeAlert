import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlertStatus, fetchAlertGuide, fetchCameraFeed, fetchWeatherData, fetchTidesData, getWeatherInfo } from '../services/api.js';
import { useSensorMqtt } from '../hooks/useSensorMqtt.js';

let CACHED_GUIDE = null;

function getAlertColors(levelKey) {
    if (levelKey === 'green') return { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' };
    if (levelKey === 'yellow') return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' };
    if (levelKey === 'orange') return { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' };
    if (levelKey === 'red') return { bg: 'bg-red-100', border: 'border-red-600', text: 'text-red-800' };
    return { bg: 'bg-gray-200', border: 'border-gray-400', text: 'text-gray-600' };
}

export default function Home() {
    const navigate = useNavigate();
    const mqttData = useSensorMqtt();

    // State
    const [waterLevel, setWaterLevel] = useState('--.-- m');
    const [alertLevelText, setAlertLevelText] = useState('LOADING...');
    const [alertLevelKey, setAlertLevelKey] = useState('green');
    const [alertHtml, setAlertHtml] = useState('System is running normally.');
    const [cameraImg, setCameraImg] = useState(null);
    const [weatherCards, setWeatherCards] = useState([]);
    const [tides, setTides] = useState([]);
    const [tidesError, setTidesError] = useState(null);
    const [isTidesLoading, setIsTidesLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    // Data fetching functions
    const loadAlertStatus = async () => {
        try {
            if (!CACHED_GUIDE) {
                CACHED_GUIDE = await fetchAlertGuide();
            }

            const data = await fetchAlertStatus();

            if (data.alertLevel === 'OFFLINE' || data.waterLevelM === null) {
                setWaterLevel('--.-- m');
                setAlertLevelText('SENSOR OFFLINE');
                setAlertLevelKey('offline');
                setIsOffline(true);
                return;
            }

            setIsOffline(false);
            const currentLevel = data.waterLevelM;
            const levelKey = data.alertLevel.toLowerCase();

            setWaterLevel(currentLevel.toFixed(2) + ' m');
            setAlertLevelKey(levelKey);

            if (CACHED_GUIDE && (CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'])) {
                const guide = CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'];
                setAlertLevelText(guide.title);

                let html = `<div class="mb-2"><strong>${guide.title}</strong><br/><em>${guide.title_tl}</em></div>`;
                html += `<p class="mb-2 text-gray-700">${guide.short_en}</p>`;
                html += `<h4 class="font-semibold mb-2 mt-4">Actions / Gabay</h4><ol class="list-decimal list-inside space-y-2 text-sm">`;

                if (guide.actions) {
                    guide.actions.forEach(act => {
                        html += `<li><strong>${act.en}</strong><div class="text-gray-700 ml-4 mb-2"><em>${act.tl}</em></div></li>`;
                    });
                }
                html += `</ol>`;
                setAlertHtml(html);
            } else {
                setAlertLevelText(`LEVEL: ${data.alertLevel}`);
            }
        } catch (error) {
            console.error("Failed to fetch status:", error);
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
            setIsOffline(false);
            const currentLevel = mqttData.waterLevelM;
            const levelKey = mqttData.currentAlertLevel ? mqttData.currentAlertLevel.toLowerCase() : 'green';

            setWaterLevel(currentLevel.toFixed(2) + ' m');
            setAlertLevelKey(levelKey);

            if (CACHED_GUIDE && (CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'])) {
                const guide = CACHED_GUIDE[levelKey] || CACHED_GUIDE['green'];
                setAlertLevelText(guide.title);

                let html = `<div class="mb-2"><strong>${guide.title}</strong><br/><em>${guide.title_tl}</em></div>`;
                html += `<p class="mb-2 text-gray-700">${guide.short_en}</p>`;
                html += `<h4 class="font-semibold mb-2 mt-4">Actions / Gabay</h4><ol class="list-decimal list-inside space-y-2 text-sm">`;

                if (guide.actions) {
                    guide.actions.forEach(act => {
                        html += `<li><strong>${act.en}</strong><div class="text-gray-700 ml-4 mb-2"><em>${act.tl}</em></div></li>`;
                    });
                }
                html += `</ol>`;
                setAlertHtml(html);
            } else {
                setAlertLevelText(`LEVEL: ${mqttData.currentAlertLevel}`);
            }

            if (mqttData.snapshotBase64 && mqttData.snapshotBase64 !== "") {
                setCameraImg(`data:image/jpeg;base64,${mqttData.snapshotBase64}`);
            }
        }
    }, [mqttData]);

    useEffect(() => {
        loadAlertStatus(); // initial load fallback
        loadWeather();
        loadTides();
        loadCamera(); // initial load fallback

        // Note: Real-time sensor and camera updates are now automatically handled by WSS MQTT hook above
        // We only poll weather/tides hourly
        const weatherInterval = setInterval(() => {
            loadWeather();
            loadTides();
        }, 3600000);

        return () => {
            clearInterval(weatherInterval);
        };
    }, []);

    const colors = getAlertColors(alertLevelKey);
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div id="home-view">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 main-title">SurgeAlert</h1>
                <p className="text-lg text-gray-600 subtitle">Intelligent flood monitoring and alert system.</p>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* LEFT COLUMN (2/3 width) */}
                <div className="md:col-span-2 space-y-8">

                    {/* 1. CAMERA CARD */}
                    <div className="custom-card">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 section-title">Live Camera Feed</h2>
                        <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden video-wrapper relative" style={{ height: '350px' }}>
                            {cameraImg ? (
                                <img src={cameraImg} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.5rem' }} alt="Live River Feed" />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-900 border-2 border-dashed border-gray-700 m-8 rounded-xl animate-pulse">
                                    <i className="fa-solid fa-video mb-2 text-2xl"></i>
                                    Waiting for Camera Feed...
                                </div>
                            )}
                        </div>
                        <div className="mt-4 text-sm text-gray-500">
                            <p>Live feed from Tullahan River monitoring station.</p>
                        </div>
                    </div>

                    {/* 2. WATER LEVEL CARD */}
                    <div id="left-alert-card" className={`custom-card ${isOffline ? 'bg-gray-200' : colors.bg}`}>
                        <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">Current water level:</p>
                            <div className="flex flex-col items-center justify-center">
                                {waterLevel === '--.-- m' ? (
                                    <div className="w-32 h-12 bg-gray-300 rounded-full animate-pulse my-2"></div>
                                ) : (
                                    <p id="water-level" className="text-5xl font-bold text-navy-900">{waterLevel}</p>
                                )}
                                <span className={`text-xs font-bold px-3 py-1 rounded-full mt-2 ${isOffline ? 'bg-gray-300 text-gray-500' : 'bg-white bg-opacity-50 text-gray-800 border border-gray-300'}`}>
                                    {isOffline ? 'Offline' : `${alertLevelKey === 'green' ? 'Normal Flow' : 'Above Threshold'}`}
                                </span>
                            </div>
                            <p id="alert-level" className={`text-lg mt-4 font-semibold ${isOffline ? 'text-gray-500' : ''}`}>
                                {alertLevelKey === 'red' && <span className="mr-2">⚠️</span>}
                                {alertLevelKey === 'green' && <span className="mr-2">✅</span>}
                                {alertLevelText}
                            </p>
                        </div>
                        {/* Legend */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <h3 className="font-semibold mb-2">Legend:</h3>
                            <ul className="space-y-1 text-sm">
                                <li className="flex items-center"><span className="h-4 w-4 rounded-full bg-green-500 mr-2 flex items-center justify-center text-[10px] text-white">✓</span> Green: Normal (&lt;15m)</li>
                                <li className="flex items-center"><span className="h-4 w-4 rounded-full bg-yellow-400 mr-2"></span> Yellow: Caution (15m - 16m)</li>
                                <li className="flex items-center"><span className="h-4 w-4 rounded-full bg-orange-500 mr-2"></span> Orange: Prepare (16m - 18m)</li>
                                <li className="flex items-center"><span className="h-4 w-4 rounded-full bg-red-600 mr-2 flex items-center justify-center text-[10px] text-white">!</span> Red: Danger (&gt;18m)</li>
                            </ul>
                        </div>
                    </div>

                    {/* 3. WEATHER FORECAST */}
                    <div className="custom-card">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 section-title">Weather Forecast</h2>
                        <div id="weather-forecast" className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                            {weatherCards.length === 0 ? (
                                <p className="col-span-full text-gray-500">Loading Weather Data...</p>
                            ) : (
                                weatherCards.map((card, i) => (
                                    <div key={i} className="bg-gray-50 p-3 rounded-lg flex flex-col items-center">
                                        <p className="font-semibold">{card.dayName}</p>
                                        <div className="text-4xl my-2">{card.icon}</div>
                                        <p className="text-sm text-gray-600 text-center leading-tight h-8 flex items-center justify-center">{card.description}</p>
                                        <p className="text-sm mt-1 font-medium">{card.tempMax}° / {card.tempMin}°</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN (1/3 width) */}
                <div className="space-y-8">

                    {/* 1. ACTIONS CARD */}
                    <div id="actions-card" className={`custom-card border-l-8 ${colors.border} pl-6`}>
                        <h2 className={`text-2xl font-semibold mb-4 section-title ${colors.text}`}>Actions</h2>
                        <div id="alert-description" className="text-sm text-gray-700 mt-2 space-y-4" dangerouslySetInnerHTML={{ __html: alertHtml }}></div>
                    </div>

                    {/* 2. TIDE FORECAST */}
                    <div id="tide-forecast-card" className="custom-card">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700 section-title">Tide Forecast</h2>
                        <div id="tide-data-container">
                            {tidesError ? (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 flex items-start">
                                    <span className="mr-2 mt-0.5">ℹ️</span>
                                    <p>Tide data is temporarily unavailable. Please check back later.</p>
                                </div>
                            ) : isTidesLoading ? (
                                <div className="space-y-3">
                                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                                </div>
                            ) : tides.length === 0 ? (
                                <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg text-sm text-gray-600">
                                    No tide data available for today.
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-500 mb-2">Data for: <strong>{today}</strong></p>
                                    <ul className="space-y-2 text-sm">
                                        {tides.map((tide, i) => {
                                            const tideTime = new Date(tide.dt * 1000);
                                            const timeString = tideTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                            const isHigh = tide.type === 'High';
                                            const tideType = isHigh ? 'High Tide' : 'Low Tide';
                                            const color = isHigh ? 'text-blue-700' : 'text-blue-500';

                                            return (
                                                <li key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                                    <span className={`font-semibold ${color} flex items-center`}>
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isHigh ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}></path>
                                                        </svg>
                                                        {tideType}
                                                    </span>
                                                    <strong>{timeString}</strong>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 3. BUTTONS */}
                    <div className="custom-card">
                        <div className="space-y-4">
                            <button onClick={() => navigate('/maps')} className="custom-btn btn-blue w-full flex justify-start">
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                Nearest Evacuation Site
                            </button>
                            <button onClick={() => navigate('/register')} className="custom-btn btn-green w-full flex justify-start">
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                Subscribe for SMS Alert
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
