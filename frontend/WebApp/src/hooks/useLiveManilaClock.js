import { useEffect, useState } from 'react';
import { formatManilaWallClockFromMs, formatManilaWallDateFromMs } from '../constants/displayTime.js';

/**
 * Ticking camera / dashboard clock: real current time in Asia/Manila.
 */
export function useLiveManilaClock() {
    const [clockLabel, setClockLabel] = useState(() => formatManilaWallClockFromMs(Date.now()));
    const [dateLabel, setDateLabel] = useState(() => formatManilaWallDateFromMs(Date.now()));

    useEffect(() => {
        const tick = () => {
            const ms = Date.now();
            setClockLabel(formatManilaWallClockFromMs(ms));
            setDateLabel(formatManilaWallDateFromMs(ms));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return { clockLabel, dateLabel };
}
