import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function DashboardView(props) {
    const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, cameraLastUpdated, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators,
        openCreateUserModal, openEditUserModal, saveUserModal,
        beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
        handleDeleteAdminUser,
        approveDatasetRequest } = props;

    return (
        <>
            {/* 1. DASHBOARD */}

            <div className="animate-fade-in">
<<<<<<< HEAD
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-black text-sky-100 tracking-tight pl-10">Dashboard</h1>
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
=======
                <div className="mb-6 flex flex-col gap-3 sm:mb-8 md:flex-row md:items-center md:justify-between">
                    <h1 className="pl-0 text-2xl font-black tracking-tight text-sky-100 sm:text-3xl md:pl-10">Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200">
>>>>>>> parent of 2f2c9a5c (.)
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${hardwareOnline ? 'bg-green-900/40 border-green-200 text-green-700' : 'bg-[#0f172a] border-slate-700 text-slate-300'}`}>
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${hardwareOnline ? 'bg-green-500' : 'bg-gray-400'} ${hardwareOnline ? 'animate-pulse' : ''}`}></span>
                            {demoMode ? 'Demo stream' : 'Hardware stream'}
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
                                <p className="text-xs text-slate-200 mt-1">Force the system to broadcast a specific alert level to residents.</p>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
<<<<<<< HEAD
                                <div className="flex space-x-2">
                                    <button onClick={() => handleOverride('NORMAL')} className="bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2 px-4 rounded-lg shadow transition">Normal/Auto</button>
                                    <button onClick={() => handleOverride('YELLOW')} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-4 rounded-lg shadow transition">Yellow</button>
                                    <button onClick={() => handleOverride('ORANGE')} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow transition">Orange</button>
                                    <button onClick={() => handleOverride('RED')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow transition">Red</button>
=======
                                <div className="flex w-full flex-wrap justify-end gap-2">
                                    <button onClick={() => handleOverride('NORMAL')} className="min-h-[44px] flex-1 bg-slate-700 px-3 py-2 font-bold text-slate-100 shadow transition hover:bg-slate-600 sm:flex-none sm:rounded-lg sm:px-4">Normal/Auto</button>
                                    <button onClick={() => handleOverride('YELLOW')} className="min-h-[44px] flex-1 bg-yellow-400 px-3 py-2 font-bold text-yellow-900 shadow transition hover:bg-yellow-500 sm:flex-none sm:rounded-lg sm:px-4">Yellow</button>
                                    <button onClick={() => handleOverride('ORANGE')} className="min-h-[44px] flex-1 bg-orange-500 px-3 py-2 font-bold text-white shadow transition hover:bg-orange-600 sm:flex-none sm:rounded-lg sm:px-4">Orange</button>
                                    <button onClick={() => handleOverride('RED')} className="min-h-[44px] flex-1 bg-red-600 px-3 py-2 font-bold text-white shadow transition hover:bg-red-700 sm:flex-none sm:rounded-lg sm:px-4">Red</button>
>>>>>>> parent of 2f2c9a5c (.)
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
                    <DashboardCard title="Current Flow Speed" value={dashData.flowRate} icon="fa-gauge-high" color="indigo" trend={trendIndicators.flowRate} subtitle={`${getFlowContext()}`} />
                    <DashboardCard title="Estimated Time to Danger" value={getETRText()} icon="fa-hourglass-half" color="teal" subtitle="Based on current flow + distance to 18m." />
                    <DashboardCard title="ML Forecast Trajectory (+1h)" value={dashData.prediction} icon="fa-brain" color="purple" subtitle="Where the water level is heading." />
                    <DashboardCard title="Active Warning Subscribers" value={dashData.subscriberCount} icon="fa-users" color="teal" subtitle="Residents currently receiving texts." />
                </div>

                {/* HEALTH + MINI-LOG */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700">
                        <h3 className="text-lg font-bold text-sky-100 mb-4 flex items-center">
                            <i className="fa-solid fa-heart-pulse mr-2 text-red-500"></i> Hardware Health
                        </h3>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                            <HealthRow label="Main Controller" ok={hardwareOnline} />
                            <HealthRow label="GSM Module" ok={hardwareOnline} />
                            <HealthRow label="Ultrasonic" ok={hardwareOnline} />
                            <HealthRow label="Speed Radar" ok={hardwareOnline} />
                        </div>
                        <div className="mt-4 text-xs text-slate-200">
                            {demoMode ? 'Mocked as online for presentations.' : 'Online if receiving telemetry in the last ~12 seconds.'}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
                        <h3 className="text-lg font-bold text-sky-100 mb-4 flex items-center">
                            <i className="fa-solid fa-rectangle-list mr-2 text-indigo-600"></i> Mini Log Feed
                        </h3>
                        <div className="flex-1 space-y-3">
                            {latestLogs.length === 0 ? (
                                <div className="text-sm text-slate-200 bg-[#0f172a] border border-slate-700 rounded-xl p-4">
                                    No recent system logs yet.
                                </div>
                            ) : (
                                latestLogs.map((log, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-[#0f172a] border border-slate-700 rounded-xl p-3">
                                        <span className="mt-1 inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-slate-200">
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
                        <div className="mt-3 text-xs text-slate-300">Showing latest 5 entries.</div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
                        <h3 className="text-lg font-bold text-sky-100 mb-4 flex items-center">
                            <i className="fa-solid fa-moon mr-2 text-indigo-500"></i> Quick Tides
                        </h3>
                        <div className="flex-1 bg-gradient-to-b from-[#0f172a] to-[#111827] rounded-xl p-6 flex flex-col justify-center text-center border border-slate-700">
                            {nextTide ? (
                                <>
                                    <div className="w-20 h-20 mx-auto bg-[#1e293b] rounded-full flex items-center justify-center shadow-md mb-4 border border-blue-900/50">
                                        <i className={`fa-solid ${nextTide.type === 'High' ? 'fa-arrow-up text-blue-500' : 'fa-arrow-down text-teal-500'} text-3xl`}></i>
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-100">Next {nextTide.type} Tide</h4>
                                    <p className="text-3xl font-black text-cyan-300 my-2">{new Date(nextTide.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-xs font-semibold text-slate-300 mb-2">{new Date(nextTide.dt * 1000).toLocaleDateString()}</p>
                                    <p className="text-xs text-slate-300">Source: WorldTides station estimate</p>
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
                        <h3 className="text-xl font-bold text-sky-100 mb-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <i className="fa-solid fa-camera mr-2 text-blue-500"></i> Media Center (Camera Feed)
                            </div>
                            {cameraLastUpdated && <span className="text-sm font-bold text-cyan-400">Last updated: {cameraLastUpdated}</span>}
                        </h3>
                        <div className="bg-black rounded-xl overflow-hidden flex-1 relative min-h-[400px]">
                            {cameraImg ? (
                                <img src={cameraImg} alt="Camera Feed" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400 border-2 border-dashed border-gray-700 m-8 rounded-xl">
                                    <div className="text-center">
                                        <i className="fa-solid fa-video-slash text-4xl mb-3"></i>
                                        <p>Camera feed currently unavailable</p>
                                    </div>
                                </div>
                            )}
                            {cameraLastUpdated && (
                                <div className="absolute top-4 right-4 bg-black/80 text-cyan-400 text-sm font-black font-mono px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)] backdrop-blur-md z-10">
                                    {cameraLastUpdated}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>



        </>
    );
}
