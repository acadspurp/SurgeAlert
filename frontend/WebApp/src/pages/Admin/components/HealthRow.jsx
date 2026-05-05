import React from 'react';

function HealthRow({ label, ok }) {
    return (
        <div className={`flex flex-col xl:flex-row items-start xl:items-center justify-between border-l-2 pl-3 p-3 gap-2 rounded-lg ${ok ? 'border-green-500 bg-green-900/10' : 'border-red-500 bg-red-900/10'}`}>
            <div className={`font-bold text-sm tracking-wide break-words ${ok ? 'text-gray-200' : 'text-red-400'}`}>{label}</div>
            <div className={`flex shrink-0 items-center gap-2 bg-black/30 px-2 py-1 rounded border border-gray-700`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></span>
                <span className={`text-xs font-bold uppercase tracking-widest ${ok ? 'text-green-500' : 'text-red-500'}`}>{ok ? 'READY' : 'Offline'}</span>
            </div>
        </div>
    );
}

export default HealthRow;
