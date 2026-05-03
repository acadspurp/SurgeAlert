import React from 'react';
import { Line } from 'react-chartjs-2';
import DashboardCard from '../components/DashboardCard';
import HealthRow from '../components/HealthRow';
import TelemetryCard from '../components/TelemetryCard';

export default function ReportsView(props) {
  const { 
    reportStart, setReportStart, reportEnd, setReportEnd, 
    reportRaw, setReportRaw,
    reportCalculated, setReportCalculated,
    reportAlerts, setReportAlerts,
    reportAI, setReportAI, 
    reportSms, setReportSms, 
    reportSubscribers, setReportSubscribers, 
    handleDownloadReport 
  } = props;

  return (
    <>
        <div className="animate-fade-in w-full max-w-4xl min-w-0">
            <h1 className="mb-6 pl-0 text-2xl font-black tracking-tight text-sky-100 sm:mb-8 sm:text-3xl md:pl-10">Download Reports</h1>
            
            <div className="flex min-w-0 flex-col gap-6 rounded-2xl border border-slate-700 bg-[#1e293b] p-4 shadow-lg sm:gap-8 sm:p-8 md:flex-row md:items-start">
                {/* Form */}
                <div className="min-w-0 flex-1 space-y-6">
                    <h3 className="border-b pb-2 text-lg font-bold text-slate-100">Filter Parameters</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="min-w-0">
                            <label className="mb-1 block text-sm font-bold text-slate-200">Start Date</label>
                            <input
                              type="date"
                              min="2026-01-01"
                              max={new Date().toISOString().split('T')[0]}
                              value={reportStart}
                              onClick={(e) => e.target.showPicker()}
                              onChange={(e)=>setReportStart(e.target.value)}
                              className="box-border w-full min-w-0 cursor-pointer rounded-xl border-2 border-slate-700 bg-[#0f172a] p-3 text-white outline-none transition focus:border-blue-500"
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="mb-1 block text-sm font-bold text-slate-200">End Date</label>
                            <input
                              type="date"
                              min="2026-01-01"
                              max={new Date().toISOString().split('T')[0]}
                              value={reportEnd}
                              onClick={(e) => e.target.showPicker()}
                              onChange={(e)=>setReportEnd(e.target.value)}
                              className="box-border w-full min-w-0 cursor-pointer rounded-xl border-2 border-slate-700 bg-[#0f172a] p-3 text-white outline-none transition focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="min-w-0">
                        <label className="mb-3 block text-sm font-bold text-slate-200">Data to Include</label>
                        <div className="space-y-3 rounded-xl border border-slate-700 bg-[#0f172a] p-4 shadow-inner">
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 group hover:bg-[#1e293b]/80" onClick={() => setReportRaw(!reportRaw)}>
                                <div className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-500 transition-colors " + (reportRaw ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportRaw && <i className="fa-solid fa-check text-xs text-white"></i>}
                                </div>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-200 transition group-hover:font-bold group-hover:text-white">Raw Sensor Readings (Flow/Rise)</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 group hover:bg-[#1e293b]/80" onClick={() => setReportCalculated(!reportCalculated)}>
                                <div className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-500 transition-colors " + (reportCalculated ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportCalculated && <i className="fa-solid fa-check text-xs text-white"></i>}
                                </div>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-200 transition group-hover:font-bold group-hover:text-white">Calculated Water Level (m)</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 group hover:bg-[#1e293b]/80" onClick={() => setReportAlerts(!reportAlerts)}>
                                <div className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-500 transition-colors " + (reportAlerts ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportAlerts && <i className="fa-solid fa-check text-xs text-white"></i>}
                                </div>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-200 transition group-hover:font-bold group-hover:text-white">Current Alert Status (Green-Red)</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 group hover:bg-[#1e293b]/80" onClick={() => setReportAI(!reportAI)}>
                                <div className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-500 transition-colors " + (reportAI ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportAI && <i className="fa-solid fa-check text-xs text-white"></i>}
                                </div>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-200 transition group-hover:font-bold group-hover:text-white">AI Flood Prediction (ML)</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 group hover:bg-[#1e293b]/80" onClick={() => setReportSms(!reportSms)}>
                                <div className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-500 transition-colors " + (reportSms ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportSms && <i className="fa-solid fa-check text-xs text-white"></i>}
                                </div>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-200 transition group-hover:font-bold group-hover:text-white">SMS Broadcast Stats (Sent/Failed)</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 group hover:bg-[#1e293b]/80" onClick={() => setReportSubscribers(!reportSubscribers)}>
                                <div className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-500 transition-colors " + (reportSubscribers ? 'bg-blue-500' : 'bg-[#1e293b]')}>
                                    {reportSubscribers && <i className="fa-solid fa-check text-xs text-white"></i>}
                                </div>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-200 transition group-hover:font-bold group-hover:text-white">Subscriber Enrollment Data / Rate</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex w-full shrink-0 flex-col justify-center rounded-xl border border-slate-700 bg-[#0f172a] p-6 md:w-64">
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
