import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function DashboardView(props) {
    const { demoMode, setDemoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, cameraLastUpdated, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators,
        openCreateUserModal, openEditUserModal, saveUserModal,
        beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
        handleDeleteAdminUser,
        approveDatasetRequest } = props;

    return (
        <>
            {/* 1. DASHBOARD */}

            <div className="animate-fade-in">
                <div className="mb-6 flex flex-col gap-3 sm:mb-8 md:flex-row md:items-center md:justify-between">
                    <h1 className="pl-0 text-2xl font-black tracking-tight text-sky-100 sm:text-3xl md:pl-10">Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200">
                        <span className="hidden sm:inline">
                            Last updated: {secondsSinceUpdate === null ? '—' : `${secondsSinceUpdate}s ago`}
                        </span>
                    </div>
                </div>

                {/* HEAD ADMIN OVERRIDE BANNER */}
                {isHeadAdmin && (
                    <div className="relative z-10 mb-8 overflow-hidden rounded-2xl border border-red-900 bg-[#1e293b] bg-gradient-to-r from-red-900/60 to-[#1e293b] shadow-lg">
                        <div className="flex items-center border-b border-red-900 bg-red-950 px-4 py-3 font-bold text-red-400 sm:px-6">
                            <i className="fa-solid fa-triangle-exclamation mr-3 shrink-0 animate-pulse text-red-500"></i>
                            <span className="min-w-0 leading-tight">OFFICIAL ALERT OVERRIDE PANEL</span>
                        </div>
                        <div className="flex flex-col items-stretch justify-between gap-4 p-4 sm:p-6 md:flex-row md:items-center">
                            <div className="min-w-0 md:mb-0">
                                <p className="text-sm text-slate-300">Current Logic Status: <span className="font-bold">{dashData.status}</span></p>
                                <p className="mt-1 flex flex-wrap items-center text-sm text-slate-300">
                                    <span className="mr-1">AI Recommended Status:</span>
                                    <span className={`font-bold ${aiRecommendedStatus === 'CRITICAL' ? 'text-purple-600 font-black animate-pulse' : aiRecommendedStatus === 'RED' ? 'text-red-600' : aiRecommendedStatus === 'ORANGE' ? 'text-orange-500' : aiRecommendedStatus === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {aiRecommendedStatus}
                                    </span>
                                    {isDivergent && <i className="fa-solid fa-triangle-exclamation ml-2 shrink-0 animate-pulse text-yellow-500" title="Divergence Detected!"></i>}
                                </p>
                                <p className="mt-1 text-xs text-slate-200">Force the system to broadcast a specific alert level to residents.</p>
                            </div>
                            <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-none md:w-auto md:items-end">
                                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                                    <button type="button" onClick={() => handleOverride('NORMAL')} className="touch-manipulation min-h-[48px] rounded-lg bg-slate-700 px-2 py-2 text-center text-sm font-bold text-slate-100 shadow transition hover:bg-slate-600 active:scale-[0.98] sm:min-h-0 sm:px-4 sm:py-2">Normal/Auto</button>
                                    <button type="button" onClick={() => handleOverride('YELLOW')} className="touch-manipulation min-h-[48px] rounded-lg bg-yellow-400 px-2 py-2 text-center text-sm font-bold text-yellow-900 shadow transition hover:bg-yellow-500 active:scale-[0.98] sm:min-h-0 sm:px-4 sm:py-2">Yellow</button>
                                    <button type="button" onClick={() => handleOverride('ORANGE')} className="touch-manipulation min-h-[48px] rounded-lg bg-orange-500 px-2 py-2 text-center text-sm font-bold text-white shadow transition hover:bg-orange-600 active:scale-[0.98] sm:min-h-0 sm:px-4 sm:py-2">Orange</button>
                                    <button type="button" onClick={() => handleOverride('RED')} className="touch-manipulation min-h-[48px] rounded-lg bg-red-600 px-2 py-2 text-center text-sm font-bold text-white shadow transition hover:bg-red-700 active:scale-[0.98] sm:min-h-0 sm:px-4 sm:py-2">Red</button>
                                    <button type="button" onClick={() => handleOverride('CRITICAL')} className="touch-manipulation min-h-[48px] rounded-lg bg-purple-700 col-span-2 sm:col-auto px-2 py-2 text-center text-sm font-bold text-white shadow transition hover:bg-purple-800 active:scale-[0.98] sm:min-h-0 sm:px-4 sm:py-2">Critical/Evac</button>
                                </div>
                                {aiRecommendedStatus !== 'NORMAL' && (
                                    <button type="button" onClick={() => handleOverride(aiRecommendedStatus)} className="touch-manipulation flex w-full items-center justify-center rounded-full border border-blue-800 bg-blue-900/40 px-3 py-2 text-xs font-bold text-blue-400 transition hover:bg-blue-900/60 active:scale-[0.98] sm:w-auto">
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

                {/* ENVIRONMENTAL CONTEXT */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-sky-100 mb-4 flex items-center px-1">
                        <i className="fa-solid fa-cloud-sun-rain mr-2 text-cyan-400"></i> Environmental Context
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                        <DashboardCard title="QC Rain (Upstream)" value={dashData.qcRain} icon="fa-cloud-showers-heavy" color="blue" subtitle="Quezon City area" />
                        <DashboardCard title="Marulas Rain (Site)" value={dashData.marulasRain} icon="fa-cloud-rain" color="indigo" subtitle="Local precipitation" />
                        <DashboardCard title="Tide Height" value={dashData.tideHeight} icon="fa-arrow-up-wide-short" color="cyan" subtitle="Current sea level" />
                        <DashboardCard title="Air Pressure" value={dashData.pressure} icon="fa-compress" color="slate" subtitle="Atmospheric pressure" />
                        <DashboardCard title="Wind Speed" value={dashData.wind} icon="fa-wind" color="teal" subtitle="Local wind velocity" />
                    </div>
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
                        <h3 className="mb-4 flex flex-col gap-2 text-lg font-bold text-sky-100 sm:flex-row sm:items-center sm:justify-between sm:text-xl">
                            <div className="flex min-w-0 items-center">
                                <i className="fa-solid fa-camera mr-2 shrink-0 text-blue-500"></i>
                                <span className="min-w-0">Media Center (Camera Feed)</span>
                            </div>
                            {cameraLastUpdated && <span className="shrink-0 text-xs font-bold text-cyan-400 sm:text-sm">Last updated: {cameraLastUpdated}</span>}
                        </h3>
                        <div className="relative flex-1 overflow-hidden rounded-xl bg-black min-h-[220px] sm:min-h-[320px] md:min-h-[400px]">
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
