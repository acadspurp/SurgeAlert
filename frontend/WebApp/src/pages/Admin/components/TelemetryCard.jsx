import React from 'react';

const colorRing = {
    blue: 'border-blue-400 text-blue-400',
    purple: 'border-purple-400 text-purple-400',
    teal: 'border-teal-400 text-teal-400',
    yellow: 'border-yellow-400 text-yellow-400',
};

function TelemetryCard({ title, value, icon, color }) {
    const ring = colorRing[color] || colorRing.blue;
    return (
        <div className={`flex min-w-0 items-center gap-3 rounded-2xl border border-gray-700 bg-[#1e293b] p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] sm:gap-5 sm:p-6`}>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-gray-900 sm:h-14 sm:w-14 ${ring}`}>
                <i className={`fa-solid ${icon} text-xl sm:text-2xl`}></i>
            </div>
            <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400 sm:text-sm">{title}</p>
                <div className="break-words text-2xl font-black text-sky-100 sm:text-3xl">{value}</div>
            </div>
        </div>
    );
}
export default TelemetryCard;
