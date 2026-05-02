import React, { useState } from 'react';
import { submitDatasetRequest } from '../services/api';

export default function About() {
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contactNumber: '',
        email: '',
        affiliation: '',
        dateFrom: '',
        dateTo: '',
        dataFields: '',
        requestLetterUrl: '',
        abstractPurpose: '',
        dpaConsent: false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const validateAndNormalizePhone = (p) => {
        if (/^9\d{9}$/.test(p)) return p;
        if (/^09\d{9}$/.test(p)) return p.substring(1);
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.dpaConsent) {
            alert("You must agree to the Data Privacy Agreement to proceed.");
            return;
        }

        const normalizedPhone = validateAndNormalizePhone(formData.contactNumber);
        if (!normalizedPhone) {
            alert("Invalid Contact Number. Please use 10 digits starting with 9 (e.g. 9123...) or 11 digits starting with 09 (e.g. 0912...).");
            return;
        }

        const fullPurpose = `
Affiliation: ${formData.affiliation}
Requested Date Range: ${formData.dateFrom} to ${formData.dateTo}
Requested Data Fields: ${formData.dataFields}
Formal Request Letter URL: ${formData.requestLetterUrl || 'Not provided'}

Abstract / Purpose of Study:
${formData.abstractPurpose}
        `.trim();

        const payload = {
            name: formData.name,
            contactNumber: normalizedPhone,
            email: formData.email,
            abstractPurpose: fullPurpose
        };

        try {
            setSubmitting(true);
            await submitDatasetRequest(payload);
            alert("Dataset request submitted successfully. It is now PENDING approval by the administrators.");
            setShowModal(false);
            setFormData({ name: '', contactNumber: '', email: '', affiliation: '', dateFrom: '', dateTo: '', dataFields: '', requestLetterUrl: '', abstractPurpose: '', dpaConsent: false });
        } catch (error) {
            alert("Error submitting request: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div id="about-view" className="py-10 bg-[#0f172a] min-h-screen -mt-8 pt-16 -mx-8 px-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* I. Hero Section */}
                <div className="text-center py-8 text-white border-0">
                    <div className="inline-block p-2 rounded-2xl bg-[#1e293b] mb-4 shadow-xl border border-gray-700">
<<<<<<< HEAD
                        <img src="/src/assets/logo.png" alt="SurgeAlert" className="w-48 h-48 object-contain" />
=======
                        <img src={logoUrl} alt="" className="w-48 h-48 object-contain" aria-hidden />
>>>>>>> parent of b53e4881 (.)
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-4 text-[#38bdf8]">SurgeAlert - Flood Monitoring System</h1>
                    <p className="text-lg font-medium text-gray-400">A Thesis Project by 4th-Year Computer Engineering students of Polytechnic University of the Philippines - Manila.</p>
                </div>

                {/* II. Research Abstract & System Purpose */}
                <div className="bg-[#1e293b] rounded-2xl p-8 border-l-4 border-[#38bdf8] shadow-lg border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white flex items-center"><i className="fa-solid fa-book-open mr-3 text-gray-400"></i> Research Abstract & System Purpose</h2>
                    <p className="text-gray-300 leading-relaxed mb-4 text-lg">
                        SurgeAlert is a high-resilience flood monitoring solution designed specifically for the Tullahan River basin.
                        By leveraging Edge Computing via Raspberry Pi and a robust Waveshare SIM7600G-H cellular interface, the system ensures
                        that critical flood alerts reach the community even during total internet outages.
                    </p>
                    <p className="text-gray-300 leading-relaxed text-lg">
                        The system integrates advanced regression models to analyze historical and real-time sensor data, providing
                        residents and local authorities with a predictive window to act before water levels reach a critical stage.
                    </p>
                </div>

                {/* III. Data & Methodology — Full Width */}
                <div className="bg-[#1e293b] rounded-2xl p-8 shadow-lg border border-gray-800">
                    <h2 className="text-xl font-bold mb-2 text-white flex items-center">
                        <i className="fa-solid fa-flask-vial mr-3 text-cyan-400"></i> How It Works
                    </h2>
                    <p className="text-gray-400 text-sm mb-7 leading-relaxed">
                        SurgeAlert continuously monitors the Tullahan River using on-site sensors and a live camera feed. Data is automatically analyzed and sent to this platform — and directly to residents via SMS when internet is unavailable.
                    </p>

                    {/* 3-Step Flow */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        {[
                            { icon: 'fa-solid fa-tower-broadcast', color: 'text-teal-400', label: '1. Sense', desc: 'Waterproof ultrasonic and radar sensors measure the river\'s water level every 10 minutes. A camera provides a live visual feed for additional confirmation.' },
                            { icon: 'fa-solid fa-brain', color: 'text-cyan-400', label: '2. Analyze', desc: 'The edge device processes sensor readings on-site and compares them against historical flood data to determine the current alert level.' },
                            { icon: 'fa-solid fa-bell', color: 'text-yellow-400', label: '3. Alert', desc: 'If a threshold is exceeded, the system immediately notifies registered residents via SMS — even during power outages and internet disruptions.' },
                        ].map(({ icon, color, label, desc }) => (
                            <div key={label} className="bg-[#0f172a] rounded-xl p-5 border border-gray-700 text-center">
                                <i className={`${icon} ${color} text-2xl mb-3 block`}></i>
                                <p className="text-gray-100 font-bold text-sm mb-2">{label}</p>
                                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Data Sources + Hardware — 2 columns */}
                    <div className="border-t border-gray-700 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-database"></i> Data Sources
                            </p>
                            <ul className="space-y-2 text-sm">
                                {[
                                    ['fa-solid fa-cloud-sun text-yellow-400', 'PAGASA MacArthur Bridge', 'Historical flood records for the Tullahan River basin'],
                                    ['fa-solid fa-satellite-dish text-teal-400', 'SurgeAlert Edge Node', 'Live on-site sensor readings, updated every 10 minutes'],
                                ].map(([iconClass, label, value]) => (
                                    <li key={label} className="flex gap-3 items-start">
                                        <i className={`${iconClass} mt-0.5 shrink-0`}></i>
                                        <span><strong className="text-gray-200">{label}:</strong> <span className="text-gray-400">{value}</span></span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-microchip"></i> Powered By
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['Raspberry Pi 4', 'Solar Power', 'RPi Camera 3', 'Ultrasonic Sensor', 'Speed Radar Sensor', 'GSM Module', '4G LTE / SMS'].map((tag) => (
                                    <span key={tag} className="bg-[#0f172a] border border-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* IV. The Research Team — Full Width */}
                <div className="bg-[#1e293b] rounded-2xl p-8 shadow-lg border border-gray-800">
                    <h2 className="text-xl font-bold mb-6 text-white flex items-center">
                        <i className="fa-solid fa-users mr-3 text-teal-400"></i> The Research Team
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        {['Angela Nicole P. Sison', 'Angelica Jane P. Tapar', 'Hannah Florence Bardon', 'Jayson Justin Cabus'].map((name) => (
                            <div key={name} className="bg-[#0f172a] border border-gray-700 rounded-xl p-4 text-center">
                                <div className="w-10 h-10 rounded-full bg-[#1e293b] border border-gray-600 flex items-center justify-center mx-auto mb-3">
                                    <i className="fa-solid fa-user-graduate text-gray-400"></i>
                                </div>
                                <p className="text-gray-200 text-sm font-semibold leading-snug">{name}</p>
                                <p className="text-gray-500 text-xs mt-1">Researcher</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 pt-5 border-t border-gray-700">
                        <div className="w-10 h-10 rounded-full bg-[#1e293b] border border-cyan-700 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-chalkboard-teacher text-cyan-400"></i>
                        </div>
                        <div>
                            <p className="text-white font-bold">Dr. Remedios G. Ado</p>
                            <p className="text-sm text-gray-400">Thesis Adviser &nbsp;·&nbsp; Dean, College of Engineering</p>
                        </div>
                    </div>
                </div>

                {/* V. Academic Collaboration */}
                <div className="bg-gradient-to-r from-[#1e293b] to-[#0f172a] rounded-2xl p-8 border border-cyan-800 shadow-xl text-center">
                    <h2 className="text-2xl font-black mb-2 text-white">Academic Collaboration</h2>
                    <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl mx-auto">
                        Are you a researcher or a student looking to access localized flood data for a case study or predictive modeling? We support academic collaboration to improve disaster resilience. Please submit a request below.
                    </p>
                    <button onClick={() => setShowModal(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-black px-8 py-4 rounded-full shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-transform transform hover:-translate-y-1 flex items-center justify-center mx-auto gap-2">
                        <i className="fa-solid fa-database"></i> Dataset Request
                    </button>
                </div>

            </div>

            {/* OVERLAY MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-[#0f172a] bg-opacity-90 flex items-start justify-center z-[2000] p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-[#1e293b] rounded-2xl border border-gray-700 max-w-2xl w-full p-8 shadow-2xl relative my-8 sm:my-16">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-2xl font-black text-white">Data Request Form</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition">
                                <i className="fa-solid fa-xmark text-2xl"></i>
                            </button>
                        </div>
                        <p className="text-sm text-cyan-400 mb-6 font-semibold"><i className="fa-solid fa-circle-info border border-cyan-400 rounded-full text-xs p-1"></i> Ensure all details are accurate to avoid rejection.</p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-100 mb-1">Name (Optional)</label>
                                    <input type="text" name="name" required className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.name} onChange={handleChange} onKeyDown={(e) => { if (e.key.length === 1 && !/^[a-zA-Z.\s]$/.test(e.key)) e.preventDefault(); }} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-100 mb-1">Institutional Email</label>
                                    <input type="email" name="email" required placeholder="name@institution.edu.ph" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.email} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-100 mb-1">Contact Number</label>
                                    <div className="flex">
                                        <span className="bg-gray-700 text-white p-3 rounded-l-lg border border-gray-600 border-r-0 font-bold">+63</span>
                                        <input type="tel" name="contactNumber" required placeholder="9XXXXXXXXX" className="w-full bg-[#0f172a] border border-gray-600 rounded-r-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.contactNumber} onChange={handleChange} onKeyDown={(e) => { if (e.key.length === 1 && !/^[0-9]$/.test(e.key)) e.preventDefault(); }} maxLength={formData.contactNumber.startsWith('0') ? 11 : 10} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-100 mb-1">Affiliation / Organization</label>
                                    <input type="text" name="affiliation" required placeholder="e.g. PUP Manila, DOST" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.affiliation} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-100 mb-1">Requested Date Range</label>
                                    <div className="flex gap-2">
                                        <input type="date" name="dateFrom" required min="2026-01-01" max={new Date().toISOString().split('T')[0]} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-cyan-500 focus:outline-none cursor-pointer" onClick={(e) => e.target.showPicker()} value={formData.dateFrom} onChange={handleChange} />
                                        <span className="flex items-center text-gray-500 text-sm">to</span>
                                        <input type="date" name="dateTo" required min="2026-01-01" max={new Date().toISOString().split('T')[0]} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-cyan-500 focus:outline-none cursor-pointer" onClick={(e) => e.target.showPicker()} value={formData.dateTo} onChange={handleChange} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-100 mb-1">Data Fields Needed</label>
                                    <input type="text" name="dataFields" required placeholder="e.g. Water Level, Flow Rate" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.dataFields} onChange={handleChange} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-100 mb-1">Formal Request Letter (Link/URL)</label>
                                <input type="url" name="requestLetterUrl" placeholder="Optional: Google Drive link to endorsed letter" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.requestLetterUrl} onChange={handleChange} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Research Abstract / Purpose</label>
                                <textarea name="abstractPurpose" required rows="2" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none resize-none" placeholder="Briefly describe what you intend to do with the requested dataset..." value={formData.abstractPurpose} onChange={handleChange}></textarea>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Data Privacy Agreement</label>
                                <div className="p-4 bg-[#0f172a] border border-gray-600 rounded-lg text-xs leading-relaxed text-gray-400 mb-3 max-h-32 overflow-y-auto">
                                    <strong className="text-gray-200">Compliance with Data Privacy Act of 2012 (R.A. 10173)</strong><br /><br />
                                    I hereby grant my independent and voluntary consent to the SurgeAlert administrators to collect, process, and retain my personal and institutional data (Name, Contact Number, Institutional Email, and Affiliations) exclusively for the assessment, verification, and fulfillment of this Dataset Request.<br /><br />
                                    I understand that my provided data will be safeguarded chronologically, kept strictly confidential, and will not be transferred to or shared with any unauthorized third parties without my explicit written consent. Furthermore, I recognize my fundamental rights to access, rectify, port, or request the immediate deletion of my personal information as definitively guaranteed by the Data Privacy Act of the Philippines.
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer mt-2">
                                    <input type="checkbox" name="dpaConsent" required checked={formData.dpaConsent} onChange={handleChange} className="w-4 h-4 cursor-pointer accent-cyan-500 rounded" />
                                    <span className="text-sm font-bold text-white">I agree to the Data Privacy Agreement</span>
                                </label>
                            </div>

                            <button type="submit" disabled={submitting} className={`w-full py-4 mt-4 rounded-xl font-black text-white shadow-lg transition-transform ${submitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>
                                {submitting ? 'Submitting Request...' : (
                                    <><i className="fa-solid fa-paper-plane mr-2"></i> Submit Request</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
