import React from 'react';

function TelemetryCard({ title, value, icon, color }) {
    return (
        <div className={`bg-[#1e293b] p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-gray-700 flex items-center`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mr-5 border-2 bg-gray-900 border-${color}-400 text-${color}-400`}>
                <i className={`fa-solid ${icon} text-2xl`}></i>
            </div>
            <div>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">{title}</p>
                <div className="text-3xl font-black text-sky-100">{value}</div>
            </div>
        </div>
    );
}
export default TelemetryCard;
