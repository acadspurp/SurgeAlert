import { useEffect, useRef, useState } from 'react';
import {
    DISPLAY_TIMEZONE,
    UI_CLOCK_ANCHOR_HOUR,
    UI_CLOCK_ANCHOR_MINUTE,
    formatManilaWallClockFromMs,
    formatManilaWallDateFromMs,
} from '../constants/displayTime.js';

function pad2(n) {
    return String(n).padStart(2, '0');
}

/** Manila calendar YYYY-MM-DD for instant `ms`. */
export function manilaYmd(ms) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: DISPLAY_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

/**
 * Epoch ms for Manila wall time UI_CLOCK_ANCHOR_HOUR:ANCHOR_MINUTE on the same calendar day as `sessionStartMs`.
 */
export function compute527AnchorInstantMs(sessionStartMs) {
    const ymd = manilaYmd(sessionStartMs);
    return Date.parse(
        `${ymd}T${pad2(UI_CLOCK_ANCHOR_HOUR)}:${pad2(UI_CLOCK_ANCHOR_MINUTE)}:00+08:00`
    );
}

/**
 * Display instant = anchor (5:27 PM Manila that day) + real elapsed time since session started.
 */
export function compute527DisplayInstantMs(sessionStartMs, anchorMs) {
    return anchorMs + (Date.now() - sessionStartMs);
}

/**
 * Ticking Manila clock that opens at 5:27 PM then counts forward (admin + public).
 */
export function useAnchored527Clock() {
    const sessionRef = useRef(null);
    if (!sessionRef.current) {
        const start = Date.now();
        sessionRef.current = {
            start,
            anchor: compute527AnchorInstantMs(start),
        };
    }

    const initialMs = compute527DisplayInstantMs(sessionRef.current.start, sessionRef.current.anchor);

    const [clockLabel, setClockLabel] = useState(() => formatManilaWallClockFromMs(initialMs));
    const [dateLabel, setDateLabel] = useState(() => formatManilaWallDateFromMs(initialMs));

    useEffect(() => {
        const { start, anchor } = sessionRef.current;
        const tick = () => {
            const ms = anchor + (Date.now() - start);
            setClockLabel(formatManilaWallClockFromMs(ms));
            setDateLabel(formatManilaWallDateFromMs(ms));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return { clockLabel, dateLabel };
}
