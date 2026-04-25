import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function TemplatesView(props) {
  const { demoMode, hardwareOnline, secondsSinceUpdate, isHeadAdmin, aiRecommendedStatus, dashData, isDivergent, handleOverride, getWaterLevelContext, getFlowContext, getETRText, latestLogs, nextTide, cameraImg, rawSensorData, telemetryChartData, telemetryChartOptions, telemetryTime, setTelemetryTime, aiChartData, commonChartOptions, searchTerm, setSearchTerm, filteredResidents, setIsAddingResident, handleDeleteResident, isAddingResident, newResidentState, setNewResidentState, handleAddManualResident, templates, setEditingTemplateType, editingTemplateType, templateDrafts, setTemplateDrafts, uiToBackend, handleSaveTemplate, datasetRequests, reportStart, setReportStart, reportEnd, setReportEnd, reportTelemetry, setReportTelemetry, reportAI, setReportAI, reportSms, setReportSms, reportSubscribers, setReportSubscribers, handleDownloadReport, adminUsers, setShowUserModal, setEditingUser, setUserForm, showUserModal, userForm, systemLogs, activeView, trendIndicators, 
    openCreateUserModal, openEditUserModal, saveUserModal, 
    beginEditTemplate, cancelEditTemplate, saveEditedTemplate,
    handleDeleteAdminUser,
    approveDatasetRequest } = props;

  return (
<>
{/* 5. TEMPLATES */}
                
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Message Templates</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {templates.map((tpl, i) => (
                                <div key={i} className="bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-700 hover:shadow-xl transition relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                        tpl.alertType === 'RED' ? 'bg-red-500' : 
                                        tpl.alertType === 'ORANGE' ? 'bg-orange-500' : 
                                        tpl.alertType === 'YELLOW' ? 'bg-yellow-400' : 
                                        tpl.alertType === 'GREEN' ? 'bg-green-500' : 
                                        tpl.alertType === 'OTP' ? 'bg-purple-500' : 
                                        tpl.alertType === 'MANUAL' ? 'bg-blue-500' : 
                                        'bg-gray-400'}`}></div>
                                    <div className="flex justify-between items-center mb-4 pl-3">
                                        <h3 className="text-xl font-bold text-sky-100 flex items-center">
                                            <i className="fa-solid fa-message mr-2 text-slate-500"></i> {tpl.alertType} ALERT
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {editingTemplateType === String(tpl.alertType).toUpperCase() ? (
                                                <>
                                                    <button
                                                        onClick={() => saveEditedTemplate(tpl.alertType)}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center"
                                                        title="Save"
                                                    >
                                                        <i className="fa-solid fa-floppy-disk mr-2"></i> Save
                                                    </button>
                                                    <button
                                                        onClick={cancelEditTemplate}
                                                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 transition flex items-center"
                                                        title="Cancel"
                                                    >
                                                        <i className="fa-solid fa-xmark mr-2"></i> Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => beginEditTemplate(tpl.alertType, tpl.template)}
                                                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center"
                                                    title="Edit template"
                                                >
                                                    <i className="fa-solid fa-pen-to-square mr-2"></i> Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        const typeKey = String(tpl.alertType).toUpperCase();
                                        const draft = templateDrafts[typeKey] ?? (tpl.template || '');
                                        const len = String(draft).length;
                                        const limit = 160;
                                        const perPart = 153; // rough estimate when concatenated
                                        const parts = len <= limit ? 1 : Math.ceil(len / perPart);
                                        const over = len > limit;
                                        const isEditing = editingTemplateType === typeKey;

                                        const legendRows = (() => {
                                            if (typeKey === 'OTP') {
                                                return [
                                                    { k: '{otp}', v: "OTP Code / OTP Code" },
                                                    { k: '{timestamp}', v: "Time / Oras (auto)" },
                                                ];
                                            }
                                            if (typeKey === 'MANUAL') {
                                                return [
                                                    { k: '{message}', v: "Manual message / Mensahe" },
                                                    { k: '{timestamp}', v: "Time / Oras (auto)" },
                                                ];
                                            }
                                            return [
                                                { k: '{name}', v: "Resident’s Name (reserved; broadcast is shared) / Pangalan" },
                                                { k: '{level}', v: "Current Water Height / Taas ng Tubig" },
                                                { k: '{status}', v: "Alert Color (Yellow/Orange/Red/Green) / Kulay" },
                                                { k: '{timestamp}', v: "Time recorded/sent / Oras (auto)" },
                                            ];
                                        })();

                                        return (
                                            <div className="flex flex-col md:flex-row gap-4 ml-3">
                                                <div className="flex-1">
                                                    <textarea
                                                        rows="5"
                                                        className="w-full border-2 border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 bg-[#0f172a] shadow-inner"
                                                        value={draft}
                                                        onChange={(e) => {
                                                            const key = String(tpl.alertType).toUpperCase();
                                                            setTemplateDrafts(prev => ({ ...prev, [key]: e.target.value }));
                                                        }}
                                                        disabled={!isEditing}
                                                        placeholder="Write your SMS template..."
                                                    ></textarea>

                                                    <div className="mt-2 flex items-center justify-between text-xs">
                                                        <div className={`font-bold ${over ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {len} / {limit} characters
                                                            <span className="ml-2 font-semibold text-slate-500">(~{parts} SMS{parts > 1 ? ' parts' : ''})</span>
                                                        </div>
                                                        <div className="text-slate-500 font-semibold">
                                                            Tip: Put Tagalog first.
                                                        </div>
                                                    </div>
                                                    {isEditing && (
                                                        <div className="mt-3 flex flex-wrap gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                                            <span className="text-xs text-slate-400 font-bold mr-1"><i className="fa-solid fa-wand-magic-sparkles mr-1"></i> Insert Data:</span>
                                                            {legendRows.map((r, idx) => (
                                                                <button key={idx} type="button" onClick={() => {
                                                                    const key = String(tpl.alertType).toUpperCase();
                                                                    setTemplateDrafts(prev => ({ ...prev, [key]: (prev[key] || '') + r.k }));
                                                                }} className="text-[11px] bg-[#0f172a] hover:bg-sky-900/60 text-sky-200 font-bold font-mono px-3 py-1.5 rounded transition shadow-sm border border-slate-600 hover:border-sky-500">
                                                                    + {r.k}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="w-full md:w-72 bg-[#1e293b] border border-slate-700 rounded-xl p-4">
                                                    <div className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3">
                                                        Legend / Cheat Sheet
                                                    </div>
                                                    <div className="space-y-2 text-xs">
                                                        {legendRows.map((r, idx) => (
                                                            <div key={idx} className="flex items-start justify-between gap-3">
                                                                <div className="font-mono font-bold text-sky-100 whitespace-nowrap">{r.k}</div>
                                                                <div className="text-slate-300 font-semibold text-right">{r.v}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                                                        Timestamp is appended automatically on the backend if missing.
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                

                
</>
  );
}
