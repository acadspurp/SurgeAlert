import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function ResidentsView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, 
    openCreateUserModal, openEditUserModal, saveUserModal, 
    beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
    handleDeleteAdminUser,
    approveDatasetRequest } = props;

  return (
<>
{/* 4. RESIDENTS */}
                
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Subscribers List</h1>
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex-1 relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name or phone number..."
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-700 bg-[#1e293b] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-slate-200"
                                />
                            </div>
                            <button
                                onClick={() => setSearchTerm("")}
                                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
                                disabled={!searchTerm}
                                title="Clear search"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setIsAddingResident(!isAddingResident)}
                                className="px-4 py-3 rounded-xl bg-green-900/40 border border-green-800 hover:bg-green-900/60 text-green-400 font-bold transition whitespace-nowrap"
                            >
                                <i className="fa-solid fa-user-plus mr-2"></i>Add Resident
                            </button>
                        </div>
                        
                        {isAddingResident && (
                            <div className="bg-[#1e293b] rounded-xl shadow border border-green-800 p-6 mb-4 animate-fade-in">
                                <h3 className="text-lg font-bold text-sky-100 mb-4">Manually Register Resident</h3>
                                <form onSubmit={handleAddManualResident} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Full Name</label>
                                        <input required type="text" className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 text-sm rounded-lg px-4 py-2 focus:border-sky-500 outline-none" value={newResidentState.name} onChange={e => setNewResidentState({...newResidentState, name: e.target.value})} placeholder="Juan Dela Cruz" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Phone Number</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 text-sm font-mono text-slate-400 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg">+63</span>
                                            <input required type="tel" maxLength="10" className="w-full bg-[#0f172a] font-mono border border-slate-700 text-slate-200 text-sm rounded-r-lg px-4 py-2 outline-none focus:border-sky-500" value={newResidentState.phone} onChange={e => setNewResidentState({...newResidentState, phone: e.target.value})} placeholder="9123456789" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition">Submit</button>
                                        <button type="button" onClick={() => setIsAddingResident(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 rounded-lg transition">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="bg-[#1e293b] rounded-2xl shadow-lg overflow-hidden border border-slate-700">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-[#0f172a]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Resident Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-[#1e293b]">
                                    {filteredResidents.map((res, i) => (
                                        <tr key={i} className="hover:bg-[#0f172a] transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-sky-100">{res.fullName || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-300">{res.phoneNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap"><span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-700"><i className="fa-solid fa-check mr-1 mt-0.5"></i> Active</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button className="text-red-500 hover:text-red-700 hover:bg-red-900/40 p-2 rounded-lg transition" onClick={() => handleDeleteResident(res.id, res.fullName)}>Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredResidents.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-10">
                                                <div className="text-center text-slate-400">
                                                    <div className="text-2xl mb-2"><i className="fa-solid fa-users-slash"></i></div>
                                                    <div className="font-bold">No residents match your search.</div>
                                                    <div className="text-sm text-slate-500 mt-1">
                                                        {searchTerm ? `Try a different keyword.` : `No active residents found.`}
                                                    </div>
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
