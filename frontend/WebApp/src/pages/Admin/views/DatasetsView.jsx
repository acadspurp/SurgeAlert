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
            <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Data Requests</h1>
            <div className="bg-[#1e293b] rounded-2xl shadow-lg overflow-hidden border border-slate-700">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#0f172a]">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Name / Affiliation</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Contact Info</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-[#1e293b]">
                        {datasetRequests.map((req, i) => (
                            <tr key={i} className="hover:bg-[#0f172a] transition">
                                <td className="px-6 py-4 text-sm">
                                    <p className="font-bold text-sky-100">{req.name}</p>
                                    <button onClick={() => alert("Abstract / Purpose:\n\n" + req.abstractPurpose)} className="text-blue-500 text-xs font-bold mt-1 hover:underline">View Purpose</button>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-slate-300">
                                    <div>{req.email}</div>
                                    <div className="text-xs text-slate-500">{req.contactNumber}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-400">
                                    {new Date(req.requestDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <select 
                                        value={req.status || 'PENDING'} 
                                        onChange={(e) => handleUpdateDatasetStatus(req.id, e.target.value)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase cursor-pointer border outline-none ${
                                            req.status === 'APPROVED' ? 'bg-green-900/30 text-green-400 border-green-800' : 
                                            req.status === 'REJECTED' ? 'bg-red-900/30 text-red-500 border-red-800' : 
                                            'bg-yellow-900/30 text-yellow-500 border-yellow-800'
                                        }`}
                                    >
                                        <option value="PENDING" className="bg-[#0f172a] text-yellow-500">PENDING</option>
                                        <option value="APPROVED" className="bg-[#0f172a] text-green-400">APPROVED</option>
                                        <option value="REJECTED" className="bg-[#0f172a] text-red-500">REJECTED</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {req.status === 'PENDING' && (
                                        <button onClick={() => {
                                            if(window.confirm('Approve this request? This will mark it as APPROVED.')) {
                                                handleUpdateDatasetStatus(req.id, 'APPROVED');
                                            }
                                        }} className="bg-green-500/20 text-green-400 border border-green-600 hover:bg-green-500 hover:text-white px-3 py-1 rounded-lg transition mr-2">
                                            Approve
                                        </button>
                                    )}
                                    {req.status === 'PENDING' && (
                                        <button onClick={() => {
                                            if(window.confirm('Reject this request?')) {
                                                handleUpdateDatasetStatus(req.id, 'REJECTED');
                                            }
                                        }} className="bg-red-500/20 text-red-400 border border-red-600 hover:bg-red-500 hover:text-white px-3 py-1 rounded-lg transition">
                                            Reject
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {datasetRequests.length === 0 && (
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
        </div>
    </>
  );
}
