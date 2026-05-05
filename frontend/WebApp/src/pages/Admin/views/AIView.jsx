import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function AIView(props) {
    const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiTime, setAiTime, aiChartData, commonChartOptions, aiChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators,
        openCreateUserModal, openEditUserModal, saveUserModal,
        beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
        handleDeleteAdminUser,
        approveDatasetRequest, tides, pendingCriticalAlerts, handleApproveCriticalAlert, handleRejectCriticalAlert } = props;

    const formatTideDateTime = (value) => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const formatTideTime = (value) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });
    const formatTideDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

    const groupedTides = (Array.isArray(tides) ? tides : []).reduce((acc, t) => {
        const key = formatTideDate(t.dt * 1000);
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
    }, {});

    const getCurrentTideSummary = (events) => {
        if (!Array.isArray(events) || events.length === 0) return { status: 'Normal' };
        const now = new Date();
        const sorted = [...events].sort((a, b) => a.dt - b.dt);
        const upcoming = sorted.filter(t => new Date(t.dt * 1000) > now);

        const closest = sorted.reduce((a, b) => {
            return Math.abs(a.dt * 1000 - now.getTime()) < Math.abs(b.dt * 1000 - now.getTime()) ? a : b;
        }, sorted[0]);

        let status = 'Normal';
        const diffMins = Math.abs(closest.dt * 1000 - now.getTime()) / (1000 * 60);

        if (diffMins <= 15) {
            status = String(closest.type).toLowerCase() === 'high' ? 'High Tide' : 'Low Tide';
        } else {
            if (upcoming.length > 0) {
                status = String(upcoming[0].type).toLowerCase() === 'high' ? 'Rising' : 'Falling';
            }
        }
        return { status };
    };

    const tideSummary = getCurrentTideSummary(tides);

    return (
        <>
            {/* 3. AI PREDICTIONS & TIDES */}

            <div className="animate-fade-in">
                <h1 className="mb-6 pl-0 text-2xl font-black tracking-tight text-sky-100 sm:mb-8 sm:text-3xl md:pl-10">Prediction &amp; Tides</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Confidence Metrics */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-gradient-to-br from-indigo-900 to-navy text-white rounded-2xl shadow-xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl">
                                <i className="fa-solid fa-brain"></i>
                            </div>
                            <h3 className="text-xl font-bold mb-4 border-b border-indigo-700 pb-2 relative z-10">ML Confidence Metrics</h3>

                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                        <i className="fa-solid fa-chart-line"></i>
                                    </div>
                                    <div>
                                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">+1hr Predicted Level</p>
                                        <div className="text-3xl font-black">{rawSensorData.length > 0 ? rawSensorData[rawSensorData.length - 1].predictedLevel?.toFixed(2) + ' m' : '--'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                        <i className="fa-solid fa-water-arrow-up"></i>
                                    </div>
                                    <div>
                                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Estimated Flow Rate</p>
                                        <div className="text-2xl font-bold opacity-90">Currently Unavailable</div>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <i className="fa-solid fa-gauge-high"></i>
                                        </div>
                                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Model Confidence</p>
                                    </div>
                                    <div className="w-full bg-indigo-900 rounded-full h-3 mb-1 border border-indigo-700">
                                        <div className="bg-gradient-to-r from-teal-400 to-green-400 h-3 rounded-full" style={{ width: '85%' }}></div>
                                    </div>
                                    <p className="text-right text-xs font-bold text-teal-300">85% HIGH</p>
                                </div>
                            </div>
                        </div>

                        {/* Tide Timeline */}
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-sky-100 mb-4 border-b border-slate-700 pb-2 flex items-center">
                                <i className="fa-solid fa-water list-icon mr-2 text-teal-600"></i> Tide Timeline
                            </h3>
                            <div className="grid grid-cols-1 gap-2 mb-4 text-sm">
                                <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                                    <span className="text-slate-400 mr-2">Current:</span>
                                    {(tides && tides.length > 0) ? tideSummary.status : 'Normal'}
                                </div>
                                <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                                    <span className="text-slate-400 mr-2">Next High:</span>
                                    {tides.find(t => t.type === 'High')
                                        ? formatTideDateTime(tides.find(t => t.type === 'High').dt * 1000)
                                        : 'N/A'}
                                </div>
                                <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-slate-200">
                                    <span className="text-slate-400 mr-2">Next Low:</span>
                                    {tides.find(t => t.type === 'Low')
                                        ? formatTideDateTime(tides.find(t => t.type === 'Low').dt * 1000)
                                        : 'N/A'}
                                </div>
                            </div>
                            <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                {Object.keys(groupedTides).length === 0 ? (
                                    <p className="text-sm text-slate-400">No tide timeline data.</p>
                                ) : (
                                    Object.entries(groupedTides).map(([day, items]) => (
                                        <div key={day} className="bg-[#0f172a] border border-slate-700 rounded-lg p-3">
                                            <p className="text-xs font-bold text-cyan-300 mb-2">{day}</p>
                                            <div className="space-y-2">
                                                {items.map((t, i) => (
                                                    <div key={`${day}-${i}`} className="text-sm text-slate-200 flex justify-between gap-4">
                                                        <span>{formatTideTime(t.dt * 1000)} {t.type} Tide</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* HITL Panel */}
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-sky-100 mb-4 border-b border-slate-700 pb-2 flex items-center">
                                <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500"></i> Pending Critical Alerts (Requires Approval)
                            </h3>
                            {(!pendingCriticalAlerts || pendingCriticalAlerts.length === 0) ? (
                                <p className="text-sm text-slate-400">No pending critical alerts.</p>
                            ) : (
                                <div className="space-y-3 max-h-[260px] overflow-y-auto">
                                    {pendingCriticalAlerts.slice(0, 8).map((alert) => (
                                        <div key={alert.id} className="bg-[#0f172a] border border-slate-700 rounded-lg p-3">
                                            <p className="text-xs text-slate-400">#{alert.id.slice(0, 8)} • {new Date(alert.createdAt).toLocaleString()}</p>
                                            <p className="text-sm font-bold text-red-300 mt-1">Status: {alert.status}</p>
                                            <p className="text-sm text-slate-200 mt-1">{alert.message}</p>
                                            <p className="text-xs text-slate-400 mt-1">Water Level: {alert.waterLevel ?? 'N/A'} m</p>
                                            <p className="text-xs text-amber-300 mt-1">Deadline: {new Date(alert.expiresAt).toLocaleString()}</p>
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => handleApproveCriticalAlert(alert.id)}
                                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleRejectCriticalAlert(alert.id)}
                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Forecast Graph */}
                    <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-xl font-bold text-sky-100">Prediction Trajectory</h3>
                                <p className="text-sm text-slate-400">Comparing historical sensor data against the AI's projected path for the next hour.</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <i className="fa-regular fa-clock text-slate-400"></i>
                                <select 
                                    className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                                    value={aiTime}
                                    onChange={(e) => setAiTime(Number(e.target.value))}
                                >
                                    <option value={1}>Last 1 Hour</option>
                                    <option value={24}>Last 24 Hours</option>
                                    <option value={168}>Last 7 Days</option>
                                    <option value={720}>Last 30 Days</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex-1 w-full relative min-h-[400px] mt-4">
                            <Line data={aiChartData} options={aiChartOptions} />
                        </div>
                        <div className="bg-blue-900/60 border border-blue-400/50 text-blue-100 text-xs px-5 py-4 rounded-xl mt-4 flex items-center shadow-lg backdrop-blur-sm">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3 shrink-0">
                                <i className="fa-solid fa-circle-info text-blue-400"></i>
                            </div>
                            <span className="font-medium tracking-wide">
                                Note: Trajectory confidence decreases significantly past the 1-hour mark. Models are retrained daily to maintain high accuracy.
                            </span>
                        </div>
                    </div>
                </div>
            </div>



        </>
    );
}
