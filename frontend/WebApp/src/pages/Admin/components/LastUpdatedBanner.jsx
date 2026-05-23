import React from 'react';
import { formatSensorAge } from '../../../constants/displayTime.js';

/** Shows age + Manila wall time for the sensor row backing the admin UI. */
export default function LastUpdatedBanner({ lastSensorAtMs, className = '' }) {
    const age = formatSensorAge(lastSensorAtMs);
    return (
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-200 ${className}`}>
            <span className="text-slate-400">Last updated:</span>
            {age.secondsAgo == null ? (
                <span>—</span>
            ) : (
                <>
                    <span>{age.relative}</span>
                    <span className="hidden text-slate-400 sm:inline">·</span>
                    <span className="hidden font-semibold text-slate-300 sm:inline">
                        {age.absoluteClock} · {age.absoluteDate} (Manila)
                    </span>
                </>
            )}
        </div>
    );
}
