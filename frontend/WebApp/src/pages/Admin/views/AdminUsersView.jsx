import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function AdminUsersView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, 
    openCreateUserModal, openEditUserModal, saveUserModal, 
    beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
    handleDeleteAdminUser,
    approveDatasetRequest } = props;

  return (
<>
{/* 7. ADMIN USERS (HEAD ADMIN ONLY) */}
                {activeView === 'admin_users' && isHeadAdmin && (
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Admin Accounts</h1>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Accounts Table */}
                            <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
                                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
                                    <h3 className="text-lg font-bold text-sky-100 flex items-center">
                                        <i className="fa-solid fa-shield-halved mr-2 text-indigo-500"></i> Admin Accounts
                                    </h3>
                                    <button onClick={openCreateUserModal} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-bold shadow transition flex items-center">
                                        <i className="fa-solid fa-plus mr-2"></i> Create
                                    </button>
                                </div>
                                <div className="overflow-x-auto p-4">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-slate-700">
                                                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                                                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {adminUsers.map((a, i) => (
                                                <tr key={i} className="hover:bg-[#0f172a]">
                                                    <td className="py-3 px-4">
                                                        <p className="font-bold text-slate-100">{a.fullName}</p>
                                                        <p className="text-xs text-slate-400 font-mono">{a.username}</p>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${a.role === 'HEAD_ADMIN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {a.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button onClick={() => openEditUserModal(a)} className="text-blue-500 hover:text-blue-700 mx-2"><i className="fa-solid fa-pen"></i></button>
                                                        <button onClick={() => handleDeleteAdminUser(a.id, a.fullName)} className="text-red-500 hover:text-red-700 mx-2"><i className="fa-solid fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* System Action Logs */}
                            <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 flex flex-col max-h-[600px]">
                                <div className="p-6 border-b border-slate-700 bg-[#0f172a]">
                                    <h3 className="text-lg font-bold text-sky-100 flex items-center">
                                        <i className="fa-solid fa-list-check mr-2 text-teal-600"></i> System Action Logs
                                    </h3>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                                    {systemLogs.length === 0 ? (
                                        <div className="text-center text-slate-400 py-8">No recorded actions.</div>
                                    ) : (
                                        systemLogs.map((log, i) => {
                                            const timeStr = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                            const isAlert = log.message.includes('OVERRIDE');
                                            return (
                                                <div key={i} className="flex gap-4">
                                                    <div className="w-16 text-xs font-bold text-slate-500 pt-1 text-right">{timeStr}</div>
                                                    <div className="flex-1 bg-[#0f172a] rounded-lg p-3 text-sm font-medium text-slate-200 border-l-4 border-l-blue-400">
                                                        {log.message}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* USER MODAL */}
                {showUserModal && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in">
                        <div className="bg-[#1e293b] rounded-2xl shadow-2xl p-8 max-w-xl w-full border border-slate-700 ring-4 ring-blue-100/60">
                            <h2 className="text-2xl font-black text-sky-100 mb-6">{editingUser ? 'Edit Account' : 'Create Account'}</h2>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-1">Name:</label>
                                    <input type="text" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full border p-3 rounded-lg bg-[#0f172a] outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Dela Cruz" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-1">Username:</label>
                                    <input type="text" disabled={!!editingUser} value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className={`w-full border p-3 rounded-lg bg-[#0f172a] outline-none focus:ring-2 focus:ring-blue-500 ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="johndoe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-1">Password {editingUser && <span className="text-xs font-normal text-slate-400">(Leave blank to keep current)</span>}:</label>
                                    <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full border p-3 rounded-lg bg-[#0f172a] outline-none focus:ring-2 focus:ring-blue-500" placeholder="***" />
                                </div>
                                
                                <div className="pt-2">
                                    <label className="block text-sm font-bold text-slate-200 mb-3">Role Selector:</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            onClick={() => setUserForm({...userForm, role: 'ADMIN'})}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition ${userForm.role === 'ADMIN' ? 'border-blue-500 bg-blue-900/40' : 'border-slate-700 hover:border-blue-300'}`}
                                        >
                                            <i className="fa-solid fa-user text-2xl text-blue-500 mb-2"></i>
                                            <h4 className="font-bold text-sky-100">Admin</h4>
                                            <p className="text-xs text-slate-400 mt-1">Standard monitoring access.</p>
                                            <ul className="text-[10px] text-slate-500 mt-2 list-disc pl-3">
                                                <li>View Dashboard</li>
                                                <li>View Telemetry</li>
                                                <li>Manage Alerts (Auto)</li>
                                            </ul>
                                        </div>
                                        <div 
                                            onClick={() => setUserForm({...userForm, role: 'HEAD_ADMIN'})}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition ${userForm.role === 'HEAD_ADMIN' ? 'border-red-500 bg-red-900/40' : 'border-slate-700 hover:border-red-300'}`}
                                        >
                                            <i className="fa-solid fa-user-shield text-2xl text-red-500 mb-2"></i>
                                            <h4 className="font-bold text-sky-100">Head Admin</h4>
                                            <p className="text-xs text-slate-400 mt-1">Full system & override control.</p>
                                            <ul className="text-[10px] text-slate-500 mt-2 list-disc pl-3">
                                                <li>Manual overrides</li>
                                                <li>Account Management</li>
                                                <li>System logs access</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                                <button onClick={() => setShowUserModal(false)} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100 font-bold transition">Cancel</button>
                                <button onClick={saveUserModal} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold shadow transition">{editingUser ? 'Save Updates' : 'Create User'}</button>
                            </div>
                        </div>
                    </div>
                )}
            
</>
  );
}
