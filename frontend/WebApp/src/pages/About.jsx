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
        dateRange: '',
        dataFields: '',
        requestLetterUrl: '',
        abstractPurpose: '',
        dpaConsent: false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.dpaConsent) {
            alert("You must agree to the Data Privacy Agreement to proceed.");
            return;
        }

        const fullPurpose = `
Affiliation: ${formData.affiliation}
Requested Date Range: ${formData.dateRange}
Requested Data Fields: ${formData.dataFields}
Formal Request Letter URL: ${formData.requestLetterUrl || 'Not provided'}

Abstract / Purpose of Study:
${formData.abstractPurpose}
        `.trim();

        const payload = {
            name: formData.name,
            contactNumber: formData.contactNumber,
            email: formData.email,
            abstractPurpose: fullPurpose
        };

        try {
            setSubmitting(true);
            await submitDatasetRequest(payload);
            alert("Dataset request submitted successfully. It is now PENDING approval by the administrators.");
            setShowModal(false);
            setFormData({ name: '', contactNumber: '', email: '', affiliation: '', dateRange: '', dataFields: '', requestLetterUrl: '', abstractPurpose: '', dpaConsent: false });
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
                    <div className="inline-block p-4 rounded-full bg-[#1e293b] mb-4 shadow-xl border border-gray-700">
                        <i className="fa-solid fa-water text-4xl text-teal-400"></i>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-4 text-[#38bdf8]">SurgeAlert Monitoring System</h1>
                    <p className="text-lg font-medium text-gray-400">A Final Year Research Project by the Computer Engineering Department, Polytechnic University of the Philippines Manila.</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* III. Data & Methodology */}
                    <div className="bg-[#1e293b] rounded-2xl p-8 shadow-lg border border-gray-800">
                        <h2 className="text-xl font-bold mb-4 text-white flex items-center"><i className="fa-solid fa-server mr-3 text-cyan-400"></i> Data & Methodology</h2>
                        <ul className="list-disc pl-5 text-gray-400 leading-relaxed space-y-2 mb-6 text-sm">
                            <li><strong className="text-gray-200">Primary Datasets:</strong> Historical hydrological data sourced from PAGASA (MacArthur Bridge Station).</li>
                            <li><strong className="text-gray-200">Real-time Telemetry:</strong> localized water level and rainfall data captured via the SurgeAlert Edge System.</li>
                        </ul>
                        <h3 className="font-semibold text-gray-300 mb-2">Technologies:</h3>
                        <ul className="list-disc pl-5 text-gray-400 leading-relaxed space-y-1 text-sm">
                            <li><strong className="text-gray-200">Backend:</strong> Spring Boot (Java) for secure data and role management.</li>
                            <li><strong className="text-gray-200">Frontend:</strong> React (JavaScript) with a dark-themed dashboard.</li>
                            <li><strong className="text-gray-200">Edge/Hardware:</strong> Python-based monitoring, Raspberry Pi, and 4G/LTE GSM Alerting.</li>
                        </ul>
                    </div>

                    {/* IV. The Research Team */}
                    <div className="bg-[#1e293b] rounded-2xl p-8 shadow-lg border border-gray-800">
                        <h2 className="text-xl font-bold mb-4 text-white flex items-center"><i className="fa-solid fa-users mr-3 text-teal-400"></i> The Research Team</h2>
                        <ul className="text-gray-300 leading-relaxed space-y-2 mb-6 font-medium text-lg">
                            <li className="flex items-center"><i className="fa-solid fa-user-graduate text-sm text-gray-500 mr-2"></i> Angelica Jane P. Tapar</li>
                            <li className="flex items-center"><i className="fa-solid fa-user-graduate text-sm text-gray-500 mr-2"></i> Angela Nicole P. Sison</li>
                            <li className="flex items-center"><i className="fa-solid fa-user-graduate text-sm text-gray-500 mr-2"></i> Hannah Florence Bardon</li>
                            <li className="flex items-center"><i className="fa-solid fa-user-graduate text-sm text-gray-500 mr-2"></i> Jayson Justin Cabus</li>
                        </ul>
                        <div className="pt-4 border-t border-gray-700">
                            <p className="text-gray-300 font-bold">Dr. Remedios G. Ado</p>
                            <p className="text-sm text-gray-500">Research Adviser</p>
                            <p className="text-sm text-gray-500 mt-1">BSCPE, PUP Manila</p>
                        </div>
                    </div>
                </div>

                {/* V. Academic Collaboration */}
                <div className="bg-gradient-to-r from-[#1e293b] to-[#0f172a] rounded-2xl p-8 border border-cyan-800 shadow-xl text-center">
                    <h2 className="text-2xl font-black mb-2 text-white">Academic Collaboration</h2>
                    <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl mx-auto">
                        Are you a researcher or student looking to access localized flood data for a case study or predictive modeling? We support academic collaboration to improve disaster resilience. Please submit a request below.
                    </p>
                    <button onClick={() => setShowModal(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-black px-8 py-4 rounded-full shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-transform transform hover:-translate-y-1 flex items-center justify-center mx-auto gap-2">
                        <i className="fa-solid fa-database"></i> Dataset Request
                    </button>
                </div>

            </div>

            {/* OVERLAY MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-[#0f172a] bg-opacity-90 flex items-center justify-center z-[2000] p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-[#1e293b] rounded-2xl border border-gray-700 max-w-2xl w-full p-8 shadow-2xl relative my-8">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
                            <i className="fa-solid fa-xmark text-2xl"></i>
                        </button>
                        
                        <h2 className="text-2xl font-black text-white mb-2">Dataset Request Form</h2>
                        <p className="text-sm text-cyan-400 mb-6 font-semibold"><i className="fa-solid fa-circle-info border border-cyan-400 rounded-full text-xs p-1"></i> Ensure all details are accurate to avoid rejection.</p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Full Name</label>
                                    <input type="text" name="name" required className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.name} onChange={handleChange} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Institutional Email</label>
                                    <input type="email" name="email" required placeholder="name@institution.edu.ph" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.email} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Contact Number</label>
                                    <input type="text" name="contactNumber" required className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.contactNumber} onChange={handleChange} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Affiliation / Organization</label>
                                    <input type="text" name="affiliation" required placeholder="e.g. PUP Manila, DOST" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.affiliation} onChange={handleChange} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Requested Date Range</label>
                                    <input type="text" name="dateRange" required placeholder="e.g. Jan 1 2024 - Mar 31 2024" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.dateRange} onChange={handleChange} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Data Fields Needed</label>
                                    <input type="text" name="dataFields" required placeholder="e.g. Water Level, Flow Rate" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.dataFields} onChange={handleChange} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Formal Request Letter (Link/URL)</label>
                                <input type="url" name="requestLetterUrl" placeholder="Optional: Google Drive link to endorsed letter" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" value={formData.requestLetterUrl} onChange={handleChange} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Research Abstract / Purpose</label>
                                <textarea name="abstractPurpose" required rows="3" className="w-full bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none resize-none" placeholder="Briefly describe what you intend to do with the requested dataset..." value={formData.abstractPurpose} onChange={handleChange}></textarea>
                            </div>

                            <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-xs text-gray-400 mt-2">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" name="dpaConsent" checked={formData.dpaConsent} onChange={handleChange} className="mt-1" />
                                    <span>
                                        <strong>Data Privacy Agreement (R.A. 10173):</strong> By submitting this request, I authorize the SurgeAlert administrators to collect and verify my personal information and affiliation strictly for the purpose of validating this dataset request.
                                    </span>
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
