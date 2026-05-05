import React from 'react';

function HealthRow({ label }) {
    return (
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between border-l-2 pl-3 p-3 gap-2 rounded-lg border-green-500 bg-green-900/10">
            <div className="font-bold text-sm tracking-wide break-words text-gray-200">{label}</div>
            <div className={`flex shrink-0 items-center gap-2 bg-black/30 px-2 py-1 rounded border border-gray-700`}>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-green-500">ONLINE</span>
            </div>
        </div>
    );
}

export default HealthRow;
