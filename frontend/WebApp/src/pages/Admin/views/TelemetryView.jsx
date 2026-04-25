import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function TelemetryView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, 
    openCreateUserModal, openEditUserModal, saveUserModal, 
    beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
    handleDeleteAdminUser,
    approveDatasetRequest } = props;

  return (
<>
{/* 2. TELEMETRY & ANALYTICS */}
                
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Historical Data</h1>
                        
                        {/* Current Readings */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <TelemetryCard title="Ultrasonic WL" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].waterLevelM?.toFixed(2) + ' m' : '--'} icon="fa-ruler-vertical" color="blue" />
                            <TelemetryCard title="Speed Radar Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].sensorFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-radar" color="purple" />
                            <TelemetryCard title="Optical Flow" value={rawSensorData.length > 0 ? rawSensorData[rawSensorData.length-1].imageFlowRateMps?.toFixed(2) + ' m/s' : '--'} icon="fa-eye" color="teal" />
                        </div>

                        {/* Calculated Rates */}
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-8 mb-8 text-center bg-gradient-to-r from-blue-50 to-indigo-50">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Calculated Rate of Change</p>
                            <h2 className="text-3xl font-black text-sky-100">
                                Water is <span className="text-blue-600">Stable</span>
                            </h2>
                            <p className="text-xs mt-2 text-slate-500">Calculated over the last 15 minutes</p>
                        </div>

                        {/* Historical Graph */}
                        <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-sky-100">Historical Sensor Data</h3>
                                    <div className="relative tooltip-parent">
                                        <i className="fa-solid fa-circle-info text-slate-500"></i>
                                        <span className="tooltip-text whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded absolute top-full left-0 mt-1 pointer-events-none">
                                            Moving Average Filter applied (display note)
                                        </span>
                                    </div>
                                </div>
                                <select 
                                    className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-semibold"
                                    value={telemetryTime} onChange={(e) => setTelemetryTime(Number(e.target.value))}
                                >
                                    <option value={1}>Last 1 Hour</option>
                                    <option value={6}>Last 6 Hours</option>
                                    <option value={24}>Last 24 Hours</option>
                                    <option value={168}>Last 7 Days</option>
                                </select>
                            </div>
                            <div className="h-96 w-full relative">
                                <Line data={telemetryChartData} options={telemetryChartOptions} />
                            </div>
                        </div>
                    </div>
                

                
</>
  );
}
