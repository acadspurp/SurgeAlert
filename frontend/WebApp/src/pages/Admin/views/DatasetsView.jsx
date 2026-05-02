import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function DatasetsView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, openCreateUserModal, openEditUserModal, saveUserModal, beginEditTemplate, cancelEditTemplate, saveEditedTemplate, handleDeleteAdminUser, handleUpdateDatasetStatus, tides } = props;

  return (
    <>
{/* DATASET REQUESTS */}
        <div className="animate-fade-in">
            <h1 className="mb-6 pl-0 text-2xl font-black tracking-tight text-sky-100 sm:mb-8 sm:text-3xl md:pl-10">Data Requests</h1>
            <div className="rounded-2xl border border-slate-700 bg-[#1e293b] shadow-lg">
                <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                    <table className="w-max min-w-full divide-y divide-slate-600/60">
                    <thead className="bg-[#0f172a]">
                        <tr>
                            <th className="min-w-[10rem] px-3 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 sm:min-w-[12rem] sm:px-6 sm:py-4">Name / Affiliation</th>
                            <th className="min-w-[12rem] px-3 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 sm:px-6 sm:py-4">Contact Info</th>
                            <th className="min-w-[6.5rem] px-3 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 sm:px-6 sm:py-4">Date</th>
                            <th className="min-w-[8.5rem] px-3 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 sm:px-6 sm:py-4">Status</th>
                            <th className="min-w-[11rem] px-3 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 sm:px-6 sm:py-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600/40 bg-[#1e293b]">
                        {(datasetRequests || []).map((req, i) => (
                            <tr key={i} className="transition hover:bg-[#0f172a]">
                                <td className="px-3 py-3 align-top text-sm sm:px-6 sm:py-4">
                                    <p className="break-words font-bold text-sky-100">{req.name}</p>
                                    <button type="button" onClick={() => alert("Abstract / Purpose:\n\n" + req.abstractPurpose)} className="mt-1 text-xs font-bold text-blue-500 hover:underline">View Purpose</button>
                                </td>
                                <td className="px-3 py-3 align-top text-sm font-mono text-slate-300 sm:px-6 sm:py-4">
                                    <div className="break-all">{req.email}</div>
                                    <div className="text-xs text-slate-500">{req.contactNumber}</div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 align-top text-sm font-semibold text-slate-400 sm:px-6 sm:py-4">
                                    {new Date(req.requestDate).toLocaleDateString()}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 align-top text-sm sm:px-6 sm:py-4">
                                    <select 
                                        value={req.status || 'PENDING'} 
                                        onChange={(e) => handleUpdateDatasetStatus(req.id, e.target.value)}
                                        className={`max-w-full cursor-pointer rounded-lg border px-2 py-1 text-xs font-bold uppercase outline-none sm:px-3 ${
                                            req.status === 'APPROVED' ? 'border-green-800 bg-green-900/30 text-green-400' : 
                                            req.status === 'REJECTED' ? 'border-red-800 bg-red-900/30 text-red-500' : 
                                            'border-yellow-800 bg-yellow-900/30 text-yellow-500'
                                        }`}
                                    >
                                        <option value="PENDING" className="bg-[#0f172a] text-yellow-500">PENDING</option>
                                        <option value="APPROVED" className="bg-[#0f172a] text-green-400">APPROVED</option>
                                        <option value="REJECTED" className="bg-[#0f172a] text-red-500">REJECTED</option>
                                    </select>
                                </td>
                                <td className="px-3 py-3 align-top text-sm font-medium sm:px-6 sm:py-4">
                                    <div className="flex min-w-[10rem] flex-wrap gap-2">
                                    {req.status === 'PENDING' && (
                                        <button type="button" onClick={() => {
                                            if(window.confirm('Approve this request? This will mark it as APPROVED.')) {
                                                handleUpdateDatasetStatus(req.id, 'APPROVED');
                                            }
                                        }} className="rounded-lg border border-green-600 bg-green-500/20 px-3 py-1 text-green-400 transition hover:bg-green-500 hover:text-white">
                                            Approve
                                        </button>
                                    )}
                                    {req.status === 'PENDING' && (
                                        <button type="button" onClick={() => {
                                            if(window.confirm('Reject this request?')) {
                                                handleUpdateDatasetStatus(req.id, 'REJECTED');
                                            }
                                        }} className="rounded-lg border border-red-600 bg-red-500/20 px-3 py-1 text-red-400 transition hover:bg-red-500 hover:text-white">
                                            Reject
                                        </button>
                                    )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {(datasetRequests || []).length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-10">
                                    <div className="text-center text-slate-400">
                                        <div className="text-2xl mb-2"><i className="fa-solid fa-folder-open"></i></div>
                                        <div className="font-bold">No pending dataset requests.</div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
                <p className="border-t border-slate-600/50 px-3 py-2 text-center text-[11px] text-slate-500 md:hidden sm:text-xs">
                    Swipe or scroll horizontally to see all columns.
                </p>
            </div>
        </div>
    </>
  );
}
