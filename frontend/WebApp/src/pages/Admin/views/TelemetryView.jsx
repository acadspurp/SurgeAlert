import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function TelemetryView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, cvChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, cvTime, setCvTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, 
    openCreateUserModal, openEditUserModal, saveUserModal, 
    beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
    handleDeleteAdminUser,
    approveDatasetRequest } = props;
  return (
<>
{/* 2. TELEMETRY & ANALYTICS */}
                
                    <div className="animate-fade-in">
                        <h1 className="mb-6 pl-0 text-2xl font-black tracking-tight text-sky-100 sm:mb-8 sm:text-3xl md:pl-10">Historical Data</h1>
                        
                        {/* Current Readings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <TelemetryCard title="Ultrasonic WL" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].waterLevelM?.toFixed(2) + ' m' : '--'} icon="fa-ruler-vertical" color="blue" />
                            <TelemetryCard title="Speed Radar Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].sensorFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-gauge-high" color="purple" />
                            <TelemetryCard title="Optical Flow (CV)" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].imageFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-video" color="teal" />
                        </div>

                        {/* Calculated Rates */}
                        <div className="mb-6 rounded-2xl border border-slate-700 bg-[#1e293b] bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-4 text-center shadow-lg sm:mb-8 sm:p-8">
                            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-300 sm:text-sm">Calculated Rate of Change</p>
                            <h2 className="text-xl font-black text-sky-100 sm:text-3xl">
                                {(() => {
                                    if (rawSensorData.length === 0) return "Calculating...";
                                    const latest = rawSensorData[rawSensorData.length-1];
                                    const rate = latest.sensorRiseRate || 0; // m/s
                                    
                                    if (rate > 0.5) return <><span className="text-red-500">Rising Fast</span> ({rate.toFixed(4)} m/s)</>;
                                    if (rate > 0.1) return <><span className="text-yellow-400">Rising</span> ({rate.toFixed(4)} m/s)</>;
                                    if (rate < -0.1) return <><span className="text-blue-400">Falling</span> ({Math.abs(rate).toFixed(4)} m/s)</>;
                                    return <><span className="text-cyan-300">Stable</span> (±0.0001 m/s)</>;
                                })()}
                            </h2>
                            <p className="text-xs mt-2 text-slate-300">Derived from the latest telemetry heartbeat</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Hardware Telemetry Graph */}
                            <div className="flex flex-col rounded-2xl border border-slate-700 bg-[#1e293b] p-4 shadow-lg sm:p-6">
                                <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-base font-bold text-sky-100 sm:text-xl">Water Level &amp; Sensor Flow History</h3>
                                    </div>
                                    <select 
                                        className="block w-full shrink-0 rounded-lg border border-slate-600 bg-slate-800 p-2.5 text-sm font-semibold text-slate-200 focus:border-blue-500 focus:ring-blue-500 sm:w-auto"
                                        value={telemetryTime} onChange={(e) => setTelemetryTime(Number(e.target.value))}
                                    >
                                        <option value={1}>Last 1 Hour</option>
                                        <option value={24}>Last 24 Hours</option>
                                        <option value={168}>Last 7 Days</option>
                                        <option value={720}>Last 30 Days</option>
                                    </select>
                                </div>
                                <div className="relative h-64 w-full min-w-0 sm:h-80">
                                    <Line data={telemetryChartData} options={telemetryChartOptions} />
                                </div>
                            </div>

                            {/* Computer Vision Graph */}
                            <div className="flex flex-col rounded-2xl border border-slate-700 bg-[#1e293b] p-4 shadow-lg sm:p-6">
                                <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                        <h3 className="min-w-0 text-base font-bold text-sky-100 sm:text-xl">Visual Water Movement Trends</h3>
                                        <div className="relative shrink-0 tooltip-parent">
                                            <i className="fa-solid fa-circle-info text-slate-500"></i>
                                            <span className="tooltip-text z-50 max-w-[12rem] whitespace-normal rounded bg-black px-2 py-1 text-xs text-white sm:whitespace-nowrap absolute left-0 top-full mt-1 pointer-events-none">
                                                Optical Flow (Derived)
                                            </span>
                                        </div>
                                    </div>
                                    <select 
                                        className="block w-full shrink-0 rounded-lg border border-slate-600 bg-slate-800 p-2.5 text-sm font-semibold text-slate-200 focus:border-blue-500 focus:ring-blue-500 sm:w-auto"
                                        value={cvTime} onChange={(e) => setCvTime(Number(e.target.value))}
                                    >
                                        <option value={1}>Last 1 Hour</option>
                                        <option value={24}>Last 24 Hours</option>
                                        <option value={168}>Last 7 Days</option>
                                        <option value={720}>Last 30 Days</option>
                                    </select>
                                </div>
                                <div className="relative h-64 w-full min-w-0 sm:h-80">
                                    <Line data={cvChartData} options={{ ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Flow (m/s)'} } } }} />
                                </div>
                            </div>
                        </div>
                    </div>
                

                
</>
  );
}
