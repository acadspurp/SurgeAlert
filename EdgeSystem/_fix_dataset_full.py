"""
Fix Dataset.csv: flood_data labels, water_level, rise_rate, alert_level.
"""
import numpy as np
import pandas as pd

PATH = r"C:\Surge\SurgeAlert\EdgeSystem\Dataset.csv"
GREEN, YELLOW, ORANGE, RED = 0, 1, 2, 3
Y_M, O_M, R_M = 3.50, 4.50, 5.50

df = pd.read_csv(PATH)
n = len(df)

# Rename target column
if "Target_Alert_Class" in df.columns:
    df = df.rename(columns={"Target_Alert_Class": "flood_data"})
elif "flood_data" not in df.columns:
    raise ValueError("Missing flood_data / Target_Alert_Class column")

fd = df["flood_data"].to_numpy(int).copy()
tide = df["Tide_Height_m"].to_numpy(float)
tide_tr = df["Tide_Trend"].to_numpy(float)
soil = df["Soil_Moisture"].to_numpy(float).clip(0, 1)
qc6 = df["QC_6hr_Sum"].to_numpy(float)
qc3 = df["QC_3hr_Sum"].to_numpy(float)
mar3 = df["Mar_3hr_Sum"].to_numpy(float)
mar24 = df["Mar_24hr_Sum"].to_numpy(float)
press = (1013.0 - df["Pressure_hPa"].to_numpy(float)) * 0.0015

qc6_l = np.roll(qc6, 2)
qc6_l[:2] = qc6[:2]
qc3_l = np.roll(qc3, 1)
qc3_l[0] = qc3[0]

hour_diff = df["Hour"].diff()
month_diff = df["Month"].diff()
breaks = ((hour_diff < -20) | (hour_diff > 5) | (month_diff != 0)).to_numpy()

rng = np.random.default_rng(2027)


def fix_flood_sequences(flood_data, brk):
    """Ensure 1 before first 2 and 1 after last 2 in each flood cluster."""
    i = 0
    while i < n:
        if flood_data[i] < 1:
            i += 1
            continue
        s = i
        while i < n and flood_data[i] >= 1:
            if i > s and brk[i]:
                break
            i += 1
        e = i - 1
        seg = flood_data[s : e + 1].copy()
        if 2 not in seg:
            i = e + 1
            continue
        idx2 = np.where(seg == 2)[0]
        if len(seg) >= 2:
            seg[idx2[0]] = 2
            if idx2[0] == 0:
                seg[0] = 1
            else:
                seg[idx2[0] - 1] = 1
            if idx2[-1] == len(seg) - 1:
                seg[-1] = 1
            else:
                seg[idx2[-1] + 1] = 1
        if len(seg) >= 3 and np.all(seg == 2):
            seg[0] = 1
            seg[-1] = 1
        flood_data[s : e + 1] = seg
        i = e + 1
    return flood_data


fd = fix_flood_sequences(fd, breaks)

wet = 0.28 * mar3 + 0.20 * qc3_l + 0.12 * mar24 + 7.0 * soil
no_flood_cap = np.minimum(
    np.where(
        (wet > 22) & (tide > 0.15),
        O_M + 0.38,
        np.where((wet > 14) | (tide > 0.45), O_M + 0.08, Y_M + 0.28),
    ),
    R_M - 0.12,
)
no_flood_floor = 1.20 + 0.50 * np.clip(tide, -1.0, 1.0)

MAX_RISE, MAX_FALL = 0.20, 0.17
FLOOD_RISE, FLOOD_FALL = 0.30, 0.22
POST_FLOOD_HIGH = 2  # hours to keep >= ~5.52 after flood ends

wl = np.zeros(n)
runoff = 0.0
post_flood_hours = 0
anticipate = np.zeros(n)
for i in range(n):
    for k in range(0, 5):
        if i + k < n and fd[i + k] >= 1:
            anticipate[i] = max(anticipate[i], 1.0 - 0.18 * k)

wl_target_peak = np.zeros(n)

for i in range(n):
    if breaks[i]:
        runoff *= 0.12
        post_flood_hours = max(0, post_flood_hours - 1)

    runoff = min(runoff * 0.90 + 0.028 * mar3[i] + 0.020 * qc6_l[i], 14.0)

    env = (
        2.66
        + 1.05 * tide[i]
        + 0.055 * runoff
        + 0.06 * tide_tr[i]
        + press[i]
        + 0.18 * soil[i]
    )

    f = fd[i]
    if f == 1:
        tgt = 5.62 + 0.009 * mar3[i] + 0.006 * qc6_l[i] + 0.04 * tide[i]
        tgt = np.clip(tgt, 5.55, 5.92)
    elif f == 2:
        tgt = 5.98 + 0.011 * mar3[i] + 0.007 * qc6_l[i]
        tgt = np.clip(tgt, 5.88, 6.10)
    else:
        tgt = env
        tgt = np.clip(tgt, no_flood_floor[i], no_flood_cap[i])
        if mar3[i] < 0.5 and qc3_l[i] < 0.5 and mar24[i] < 5:
            tgt = min(tgt, Y_M - 0.05)
        if mar3[i] > 20 or qc6[i] > 25:
            tgt = max(tgt, min(O_M + 0.25, R_M - 0.18))
        elif mar3[i] > 12 or qc6[i] > 15:
            tgt = max(tgt, min(Y_M + 0.65, O_M + 0.05))
        if post_flood_hours > 0:
            tgt = max(tgt, R_M + 0.02 + 0.08 * post_flood_hours)
            post_flood_hours -= 1

    if anticipate[i] > 0 and f == 0:
        tgt = max(tgt, R_M - 0.35 + 0.30 * anticipate[i])

    tgt += rng.normal(0, 0.010)
    wl_target_peak[i] = tgt

    if i == 0 or breaks[i]:
        wl[i] = float(np.clip(tgt, 1.15, 6.15))
        continue

    prev = wl[i - 1]
    active = f >= 1 or fd[i - 1] >= 1 or anticipate[i] > 0.35 or post_flood_hours >= 0
    rise_lim = FLOOD_RISE if (f >= 1 or fd[i - 1] >= 1) else MAX_RISE
    fall_lim = FLOOD_FALL if active else MAX_FALL

    if f == 0 and fd[i - 1] >= 1:
        post_flood_hours = POST_FLOOD_HIGH

    delta = float(np.clip(tgt - prev, -fall_lim, rise_lim))
    wl[i] = prev + delta

    if f == 0:
        wl[i] = min(wl[i], R_M - 0.10)
    elif f == 1:
        wl[i] = float(np.clip(wl[i], 5.55, 5.92))
    elif f == 2:
        wl[i] = float(np.clip(wl[i], 5.88, 6.10))

    wl[i] = float(np.clip(wl[i], 1.15, 6.15))

# Intra-event variation (avoid flat flood plateaus)
i = 0
while i < n:
    if fd[i] < 1:
        i += 1
        continue
    s = i
    while i < n and fd[i] >= 1:
        if i > s and breaks[i]:
            break
        i += 1
    e = i - 1
    L = e - s + 1
    for k, j in enumerate(range(s, e + 1)):
        phase = np.pi * k / max(L - 1, 1)
        bump = 0.07 * np.sin(phase) if fd[j] == 2 else 0.05 * np.sin(phase)
        cap_hi = 6.10 if fd[j] == 2 else 5.92
        cap_lo = 5.88 if fd[j] == 2 else 5.55
        if fd[j] == 1:
            cap_lo, cap_hi = 5.55, 5.92
        wl[j] = float(np.clip(wl[j] + bump, cap_lo, cap_hi))
    i = e + 1

# Forward rate-limit pass
for i in range(1, n):
    if breaks[i]:
        continue
    lim_r = FLOOD_RISE if fd[i] >= 1 or fd[i - 1] >= 1 else MAX_RISE
    lim_f = FLOOD_FALL if (fd[i] >= 1 or fd[i - 1] >= 1 or wl[i - 1] >= O_M) else MAX_FALL
    d = wl[i] - wl[i - 1]
    if d > lim_r:
        wl[i] = wl[i - 1] + lim_r
    elif d < -lim_f:
        wl[i] = wl[i - 1] - lim_f
    if fd[i] == 1:
        wl[i] = float(np.clip(wl[i], 5.55, 5.92))
    elif fd[i] == 2:
        wl[i] = float(np.clip(wl[i], 5.88, 6.10))
    elif fd[i] == 0:
        wl[i] = min(wl[i], R_M - 0.10)

# Enforce flood_data level ordering: class 2 >= class 1 at same cluster
i = 0
while i < n:
    if fd[i] < 1:
        i += 1
        continue
    s = i
    while i < n and fd[i] >= 1:
        if i > s and breaks[i]:
            break
        i += 1
    e = i - 1
    for j in range(s, e + 1):
        if fd[j] == 2:
            wl[j] = max(wl[j], 5.90)
        elif fd[j] == 1:
            wl[j] = min(wl[j], 5.95)
    for j in range(s + 1, e + 1):
        if fd[j] == 2 and fd[j - 1] == 1:
            wl[j] = max(wl[j], wl[j - 1] + 0.08)
        if fd[j] == 1 and fd[j - 1] == 2:
            wl[j] = min(wl[j], wl[j - 1] - 0.06)
    i = e + 1

# Break flat runs (3+ identical)
for i in range(2, n):
    if breaks[i]:
        continue
    if wl[i] == wl[i - 1] == wl[i - 2]:
        nudge = 0.012 * tide_tr[i] + rng.normal(0, 0.006)
        if abs(nudge) < 0.004:
            nudge = 0.006 * np.sign(tide_tr[i] or 1)
        wl[i] = round(wl[i] + nudge, 3)
        if fd[i] == 0:
            wl[i] = min(wl[i], R_M - 0.10)
        elif fd[i] == 2:
            wl[i] = float(np.clip(wl[i], 5.88, 6.10))
        elif fd[i] == 1:
            wl[i] = float(np.clip(wl[i], 5.55, 5.92))

# Final cap on hourly change (iterate until no spike > 0.35)
for _ in range(4):
    for i in range(1, n):
        if breaks[i]:
            continue
        lim_r = 0.32 if fd[i] >= 1 or fd[i - 1] >= 1 else 0.20
        lim_f = 0.24 if (fd[i] >= 1 or fd[i - 1] >= 1 or wl[i - 1] >= O_M) else 0.18
        d = wl[i] - wl[i - 1]
        if d > lim_r:
            wl[i] = wl[i - 1] + lim_r
        elif d < -lim_f:
            wl[i] = wl[i - 1] - lim_f
        if fd[i] == 1:
            wl[i] = float(np.clip(wl[i], 5.55, 5.92))
        elif fd[i] == 2:
            wl[i] = float(np.clip(wl[i], 5.88, 6.10))
        elif fd[i] == 0:
            wl[i] = min(wl[i], R_M - 0.05)

wl = np.round(wl, 3)

rise = np.zeros(n)
rise[1:] = np.diff(wl)
rise[breaks] = 0.0
rise = np.round(rise, 3)

# alert_level from water_level (0=Green, 1=Yellow, 2=Orange, 3=Red)
alert_level = np.zeros(n, dtype=int)
alert_level[wl < Y_M] = GREEN
alert_level[(wl >= Y_M) & (wl < O_M)] = YELLOW
alert_level[(wl >= O_M) & (wl < R_M)] = ORANGE
alert_level[wl >= R_M] = RED

df["flood_data"] = fd
df["alert_level"] = alert_level
df["water_level"] = wl
df["rise_rate"] = rise

# Column order
cols = [
    "Month", "Hour", "Tide_Height_m", "Tide_Trend", "Pressure_hPa", "Press_Trend",
    "Wind_Speed", "Wind_Sin", "Wind_Cos", "Soil_Moisture",
    "QC_Rain_mm", "QC_Rain_Lag1", "QC_Rain_Lag2", "QC_3hr_Sum", "QC_6hr_Sum",
    "Marulas_Rain_mm", "Mar_Rain_Lag1", "Mar_Rain_Lag2", "Mar_3hr_Sum", "Mar_24hr_Sum",
    "flood_data", "alert_level", "water_level", "rise_rate",
]
df = df[cols]
df.to_csv(PATH, index=False)

# QA summary
print("Saved", PATH)
print("\nflood_data value counts:\n", pd.Series(fd).value_counts().sort_index())
print("\nalert_level counts:\n", pd.Series(alert_level).value_counts().sort_index())
print("\nwater_level by flood_data:")
print(df.groupby("flood_data")["water_level"].agg(["min", "mean", "max"]).round(3))
c0 = df[df.flood_data == 0]
heavy = c0[c0.Mar_3hr_Sum > 20]
print("\nHeavy rain class0: n=", len(heavy), "orange+",
      ((heavy.water_level >= O_M) & (heavy.water_level < R_M)).sum() if len(heavy) else 0)
flat = sum(
    1
    for i in range(2, n)
    if not breaks[i] and wl[i] == wl[i - 1] == wl[i - 2]
)
print("Flat runs 3+:", flat)
print("Flood below 5.5:", (df[df.flood_data >= 1].water_level < R_M).sum())
print("Class2 max wl:", df[df.flood_data == 2].water_level.max())
