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

export function normalizeSensorRow(row) {
    if (!row || typeof row !== 'object') return null;
    const ts = normalizeSensorInstant(row.timestamp);
    if (!ts || Number.isNaN(Date.parse(ts))) return null;
    return {
        ...row,
        timestamp: ts,
        waterLevelM: row.waterLevelM != null ? parseNum(row.waterLevelM) : parseNum(row.water_level),
        sensorFlowRateMps: row.sensorFlowRateMps != null ? parseNum(row.sensorFlowRateMps) : parseNum(row.sensor_flow_rate_mps),
        imageFlowRateMps: row.imageFlowRateMps != null ? parseNum(row.imageFlowRateMps) : parseNum(row.image_flow_rate_mps),
        imageRiseRateMps: row.imageRiseRateMps != null ? parseNum(row.imageRiseRateMps) : parseNum(row.rise_rate),
        sensorRiseRate: row.sensorRiseRate != null ? parseNum(row.sensorRiseRate) : parseNum(row.sensor_rise_rate),
        currentAlertLevel: row.currentAlertLevel ?? row.current_alert_level,
        predictedLevel: row.predictedLevel != null ? parseNum(row.predictedLevel) : parseNum(row.predicted_level),
        predictedAlertLevel: row.predictedAlertLevel ?? row.predicted_alert_level,
    };
}

export function normalizeSensorRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(normalizeSensorRow).filter(Boolean);
}

export function countValidTimestampRows(rows) {
    return (rows || []).filter((r) => r?.timestamp && Number.isFinite(new Date(r.timestamp).getTime())).length;
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

function publicCsvUrl() {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${prefix}sensor_data.csv`;
}

export async function loadShiftedSensorRowsFromPublicCsv(hours) {
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
