import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function ReportsView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, openCreateUserModal, openEditUserModal, saveUserModal, beginEditTemplate, cancelEditTemplate, saveEditedTemplate, handleDeleteAdminUser, approveDatasetRequest } = props;



  return (
    <>
{/* 6. REPORTS */}
        <div className="animate-fade-in max-w-4xl">
            <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Download Reports</h1>
            
            <div className="bg-[#1e293b] p-8 rounded-2xl shadow-lg border border-slate-700 flex flex-col md:flex-row gap-8">
                {/* Form */}
                <div className="flex-1 space-y-6">
                    <h3 className="text-lg font-bold text-slate-100 border-b pb-2">Filter Parameters</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-200 mb-1">Start Date</label>
                            <input
                              type="date"
                              min="2026-01-01"
                              max={new Date().toISOString().split('T')[0]}
                              value={reportStart}
                              onClick={(e) => e.target.showPicker()}
                              onChange={(e)=>setReportStart(e.target.value)}
                              className={`w-full border-2 rounded-xl p-3 focus:border-blue-500 outline-none transition bg-[#0f172a] border-slate-700 cursor-pointer text-white`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-200 mb-1">End Date</label>
                            <input
                              type="date"
                              min="2026-01-01"
                              max={new Date().toISOString().split('T')[0]}
                              value={reportEnd}
                              onClick={(e) => e.target.showPicker()}
                              onChange={(e)=>setReportEnd(e.target.value)}
                              className={`w-full border-2 rounded-xl p-3 focus:border-blue-500 outline-none transition bg-[#0f172a] border-slate-700 cursor-pointer text-white`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-200 mb-3">Data to Include</label>
                        <div className="space-y-3 bg-[#0f172a] border border-slate-700 p-4 rounded-xl shadow-inner">
                            <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportTelemetry(!reportTelemetry)}>
                                <div className={"w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors " + (reportTelemetry ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportTelemetry && <i className="fa-solid fa-check text-white text-xs"></i>}
                                </div>
                                <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition group-hover:font-bold">Sensor Telemetry Data</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportAI(!reportAI)}>
                                <div className={"w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors " + (reportAI ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportAI && <i className="fa-solid fa-check text-white text-xs"></i>}
                                </div>
                                <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition group-hover:font-bold">AI Performance & Predictions</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportSms(!reportSms)}>
                                <div className={"w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors " + (reportSms ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportSms && <i className="fa-solid fa-check text-white text-xs"></i>}
                                </div>
                                <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition group-hover:font-bold">SMS Broadcast Stats (Sent/Failed)</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setReportSubscribers(!reportSubscribers)}>
                                <div className={"w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center transition-colors " + (reportSubscribers ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportSubscribers && <i className="fa-solid fa-check text-white text-xs"></i>}
                                </div>
                                <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition group-hover:font-bold">Subscriber Enrollment Data / Rate</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="w-full md:w-64 bg-[#0f172a] p-6 rounded-xl border border-slate-700 flex flex-col justify-center">
                    <h3 className="text-sm font-bold text-center text-slate-400 uppercase tracking-widest mb-6">Export As</h3>
                    <button onClick={() => handleDownloadReport('xlsx')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-md transition mb-4 flex items-center justify-center">
                        <i className="fa-solid fa-file-excel text-xl mr-2"></i> Download
                    </button>
                    <p className="text-xs text-center text-slate-500 mt-4">Generates a professional Excel report based on standard parameters.</p>
                </div>
            </div>
        </div>
    </>
  );
}
