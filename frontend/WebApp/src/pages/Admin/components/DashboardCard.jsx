import React from 'react';

function DashboardCard({ title, value, icon, color, subtitle, trend }) {
    const colorClasses = {
        blue: "text-[#38bdf8] bg-sky-900/20 shadow-[0_0_15px_rgba(14,165,233,0.3)] border-sky-500",
        indigo: "text-indigo-400 bg-indigo-900/20 shadow-[0_0_15px_rgba(99,102,241,0.3)] border-indigo-500",
        purple: "text-purple-400 bg-purple-900/20 shadow-[0_0_15px_rgba(168,85,247,0.3)] border-purple-500",
        teal: "text-[#2dd4bf] bg-teal-900/20 shadow-[0_0_15px_rgba(20,184,166,0.3)] border-teal-500"
    };
    const mapped = colorClasses[color] || colorClasses.blue;
    const parts = mapped.split(' ');
    const textColor = parts[0];
    const bgColor = parts[1];
    const shadowColor = parts[2];
    const borderColor = parts[3];

    return (
        <div className={`bg-[#1e293b] p-6 rounded-2xl border ${borderColor} ${shadowColor} flex flex-col justify-between overflow-hidden group hover:-translate-y-1 transition duration-300`}>
            <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-tight w-2/3">{title}</p>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border ${borderColor} ${bgColor} ${textColor} flex-shrink-0`}>
                    <i className={`fa-solid ${icon} drop-shadow-md`}></i>
                </div>
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <h3 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight ${textColor} whitespace-normal break-words`}>{value}</h3>
                    {trend && trend !== '-' && (
                        <span className={`text-xl font-black ${trend === '↑' ? 'text-green-500' : 'text-green-500'}`} title="Trend vs previous tick">
                            {trend}
                        </span>
                    )}
                    {trend === '-' && (
                        <span className="text-sm font-bold text-slate-500" title="No significant change">—</span>
                    )}
                </div>
                {subtitle && <p className="mt-4 break-words rounded border-l-2 border-slate-600 bg-black/30 p-2 text-sm font-semibold text-gray-300">{subtitle}</p>}
            </div>
        </div>
    );
}

export default DashboardCard;
