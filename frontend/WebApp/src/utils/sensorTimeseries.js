import Papa from 'papaparse';

const DD_MM_YYYY_HM = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const HAS_TZ_SUFFIX = /[zZ]$|[+-][0-9]{2}:?[0-9]{2}$/;

function pad2(n) {
    return String(n).padStart(2, '0');
}

/** Wall time in Philippines as an ISO string with explicit +08:00 offset. */
export function wallManilaToIsoUtc(y, mo, d, h, mi, se = 0) {
    return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(se)}+08:00`;
}

/**
 * Normalize timestamps from API (naive ISO) or CSV (DD/MM/YYYY HH:mm) for Chart.js.
 * Naive `2026-05-05T12:00:00` from the backend is treated as Asia/Manila wall time.
 */
export function normalizeSensorInstant(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    const s = String(value).trim();

    const m = DD_MM_YYYY_HM.exec(s);
    if (m) {
        const d = Number(m[1]);
        const mo = Number(m[2]);
        const y = Number(m[3]);
        const h = Number(m[4]);
        const mi = Number(m[5]);
        const se = m[6] != null ? Number(m[6]) : 0;
        if (![d, mo, y, h, mi, se].every((n) => Number.isFinite(n))) return null;
        return wallManilaToIsoUtc(y, mo, d, h, mi, se);
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !HAS_TZ_SUFFIX.test(s)) {
        return `${s}+08:00`;
    }

    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
    return null;
}

function parseNum(v) {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Radar/fused/CV flow from API row (snake_case or camelCase). */
export function resolveSensorFlowMps(row) {
    if (!row || typeof row !== 'object') return null;
    return parseNum(
        row.sensorFlowRate ?? row.sensor_flow_rate ?? row.sensorFlowRateMps
            ?? row.fusedFlowRate ?? row.fused_flow_rate
            ?? row.imageFlowRate ?? row.image_flow_rate
    );
}

export function normalizeSensorRow(row) {
    if (!row || typeof row !== 'object') return null;
    const ts = normalizeSensorInstant(row.timestamp);
    if (!ts || Number.isNaN(Date.parse(ts))) return null;
    return {
        ...row,
        timestamp: ts,
        waterLevelM: row.waterLevelM != null ? parseNum(row.waterLevelM) : parseNum(row.water_level),
        sensorFlowRate: resolveSensorFlowMps(row),
        imageFlowRate: row.imageFlowRate != null ? parseNum(row.imageFlowRate)
            : (row.imageFlowRateMps != null ? parseNum(row.imageFlowRateMps) : parseNum(row.image_flow_rate)),
        fusedFlowRate: row.fusedFlowRate != null ? parseNum(row.fusedFlowRate) : parseNum(row.fused_flow_rate),
        riseRate: row.riseRate != null ? parseNum(row.riseRate)
            : (row.riseRateMh != null ? parseNum(row.riseRateMh)
                : (row.riseRateMph != null ? parseNum(row.riseRateMph) : parseNum(row.rise_rate))),
        currentAlertLevel: row.currentAlertLevel ?? row.current_alert_level,
        predictedLevel: row.predictedLevel != null ? parseNum(row.predictedLevel) : parseNum(row.predicted_level),
        predictedAlertLevel: row.predictedAlertLevel ?? row.predicted_alert_level,
        snapshotBase64: row.snapshotBase64 ?? row.snapshot_base64 ?? null,
    };
}

export function normalizeSensorRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(normalizeSensorRow).filter(Boolean);
}

export function countValidTimestampRows(rows) {
    return (rows || []).filter((r) => r?.timestamp && Number.isFinite(new Date(r.timestamp).getTime())).length;
}

/** Newest row by timestamp (for latest KPIs when API order is not guaranteed). */
export function pickNewestSensorRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) return null;
    return list.reduce((best, row) => {
        if (!row?.timestamp) return best;
        const t = new Date(row.timestamp).getTime();
        if (!Number.isFinite(t)) return best;
        if (!best) return row;
        const bt = new Date(best.timestamp).getTime();
        return t >= bt ? row : best;
    }, null);
}

export function sortSensorRowsNewestFirst(rows) {
    return [...(rows || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function trimRowsToLastHours(rows, hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return (rows || []).filter((r) => new Date(r.timestamp).getTime() >= cutoff);
}

export function csvTextToSensorRows(csvText) {
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (!parsed.data?.length) return [];
    return normalizeSensorRows(parsed.data);
}

/** Slide the whole series so the newest sample is "now" (keeps shape; fits chart window). */
export function shiftSensorRowsAlignEndToNow(rows) {
    if (!rows.length) return [];
    const times = rows.map((r) => new Date(r.timestamp).getTime());
    const maxT = Math.max(...times);
    const offset = Date.now() - maxT;
    return rows.map((r) => ({
        ...r,
        timestamp: new Date(new Date(r.timestamp).getTime() + offset).toISOString(),
    }));
}

/** When false (default), charts do not use shifted public/sensor_data.csv in production. */
export function isCsvDemoFallbackEnabled() {
    return import.meta.env.VITE_DEMO_MODE === 'true';
}

function publicCsvUrl() {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${prefix}sensor_data.csv`;
}

export async function loadShiftedSensorRowsFromPublicCsv(hours) {
    if (!isCsvDemoFallbackEnabled()) return [];
    const res = await fetch(publicCsvUrl());
    if (!res.ok) throw new Error(`sensor_data.csv HTTP ${res.status}`);
    const text = await res.text();
    const rows = csvTextToSensorRows(text);
    if (!rows.length) return [];
    const shifted = shiftSensorRowsAlignEndToNow(rows);
    return trimRowsToLastHours(shifted, hours).sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
}

export async function getLatestFromPublicCsvShifted() {
    if (!isCsvDemoFallbackEnabled()) return null;
    try {
        const res = await fetch(publicCsvUrl());
        if (!res.ok) return null;
        const rows = csvTextToSensorRows(await res.text());
        if (!rows.length) return null;
        const shifted = shiftSensorRowsAlignEndToNow(rows);
        return shifted[shifted.length - 1] || null;
    } catch {
        return null;
    }
}
