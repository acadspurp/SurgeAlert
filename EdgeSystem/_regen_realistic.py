"""
Regenerate water_level + rise_rate for ML training (smooth, rate-limited).
"""
import numpy as np
import pandas as pd

PATH = r"C:\Surge\SurgeAlert\EdgeSystem\Dataset.csv"
YELLOW, ORANGE, RED = 3.50, 4.50, 5.50

df = pd.read_csv(PATH)
n = len(df)
rng = np.random.default_rng(2026)

tide = df["Tide_Height_m"].to_numpy(float)
tide_tr = df["Tide_Trend"].to_numpy(float)
soil = df["Soil_Moisture"].to_numpy(float).clip(0, 1)
qc6 = df["QC_6hr_Sum"].to_numpy(float)
qc3 = df["QC_3hr_Sum"].to_numpy(float)
mar3 = df["Mar_3hr_Sum"].to_numpy(float)
mar24 = df["Mar_24hr_Sum"].to_numpy(float)
alert = df["Target_Alert_Class"].to_numpy(int)
press = (1013.0 - df["Pressure_hPa"].to_numpy(float)) * 0.0015

qc6_l = np.roll(qc6, 2)
qc6_l[:2] = qc6[:2]
qc3_l = np.roll(qc3, 1)
qc3_l[0] = qc3[0]

hour_diff = df["Hour"].diff()
month_diff = df["Month"].diff()
breaks = ((hour_diff < -20) | (hour_diff > 5) | (month_diff != 0)).to_numpy()

anticipate = np.zeros(n)
for i in range(n):
    for k in range(0, 5):
        if i + k < n and alert[i + k] >= 1:
            anticipate[i] = max(anticipate[i], 1.0 - 0.18 * k)

wet = 0.25 * mar3 + 0.18 * qc3_l + 0.10 * mar24 + 6.0 * soil
no_flood_cap = np.minimum(
    np.where(
        (wet > 22) & (tide > 0.2),
        ORANGE + 0.32,
        np.where((wet > 12) | (tide > 0.5), ORANGE + 0.05, YELLOW + 0.25),
    ),
    RED - 0.18,
)
no_flood_floor = 1.22 + 0.48 * np.clip(tide, -1.0, 1.0)

MAX_RISE, MAX_FALL = 0.18, 0.16
FLOOD_RISE, FLOOD_FALL = 0.28, 0.20

wl = np.zeros(n)
runoff_state = 0.0
flood_memory = 0.0
recession = 0.0

for i in range(n):
    if breaks[i]:
        runoff_state *= 0.12
        flood_memory *= 0.4
        recession *= 0.5

    inflow = 0.028 * mar3[i] + 0.020 * qc6_l[i] + 0.010 * qc3_l[i]
    runoff_state = min(runoff_state * 0.90 + inflow, 12.0)

    rain_push = 0.14 * min(1.0, mar3[i] / 12.0) + 0.10 * min(1.0, qc6_l[i] / 18.0)
    if alert[i] >= 1:
        flood_memory = min(1.0, flood_memory + 0.45)
    elif anticipate[i] > 0:
        flood_memory = min(1.0, max(flood_memory, anticipate[i] * 0.92))
    else:
        flood_memory = max(flood_memory * 0.91, rain_push * 0.25)

    env = (
        2.68
        + 1.04 * tide[i]
        + 0.06 * tide_tr[i]
        + press[i]
        + 0.055 * runoff_state
        + 0.20 * soil[i]
        + rng.normal(0, 0.008)
    )

    flood_peak = RED + 0.12 + 0.12 * max(0, alert[i] - 1) + 0.005 * mar3[i]
    tgt = env + flood_memory * max(0.0, flood_peak - env)

    if alert[i] == 0:
        tgt = np.clip(tgt, no_flood_floor[i], no_flood_cap[i])
        if mar3[i] < 0.5 and qc3_l[i] < 0.5 and mar24[i] < 5:
            tgt = min(tgt, YELLOW - 0.05)
        if recession > 0:
            tgt = min(tgt, recession)
    else:
        tgt = max(tgt, RED + 0.10 + 0.14 * (alert[i] - 1))

    if i == 0 or breaks[i]:
        wl[i] = float(np.clip(tgt, 1.15, 8.5))
        if alert[i] == 0:
            wl[i] = min(wl[i], RED - 0.15)
        if alert[i] >= 1:
            recession = wl[i]
        continue

    prev = wl[i - 1]
    active = flood_memory > 0.3 or alert[i] >= 1 or alert[i - 1] >= 1 or anticipate[i] > 0.4
    rise_lim = FLOOD_RISE if active else MAX_RISE
    fall_lim = FLOOD_FALL if (active or recession > 0) else MAX_FALL

    if alert[i] == 0 and alert[i - 1] >= 1:
        recession = max(recession, prev)

    delta = float(np.clip(tgt - prev, -fall_lim, rise_lim))
    wl[i] = prev + delta

    if alert[i] == 0:
        wl[i] = min(wl[i], RED - 0.15)
        if recession > 0:
            wl[i] = min(wl[i], recession - FLOOD_FALL)
            recession = max(recession - FLOOD_FALL, wl[i])
    else:
        need = RED + 0.10 + 0.14 * (alert[i] - 1)
        wl[i] = min(max(wl[i], need), prev + FLOOD_RISE)

    wl[i] = float(np.clip(wl[i], 1.15, 8.5))

# Forward-only flood floor (max one step per hour)
for _ in range(3):
    for i in range(1, n):
        if breaks[i] or alert[i] < 1:
            continue
        need = RED + 0.10 + 0.14 * (alert[i] - 1)
        if wl[i] < need:
            wl[i] = min(need, wl[i - 1] + FLOOD_RISE)

# Rate-limit any remaining spikes (forward only)
for i in range(1, n):
    if breaks[i]:
        continue
    lim_r = FLOOD_RISE if anticipate[i] > 0.3 or alert[i] >= 1 else MAX_RISE
    lim_f = FLOOD_FALL if (alert[i - 1] >= 1 or wl[i - 1] >= RED) else MAX_FALL
    d = wl[i] - wl[i - 1]
    if d > lim_r:
        wl[i] = wl[i - 1] + lim_r
    elif d < -lim_f:
        wl[i] = wl[i - 1] - lim_f
    if alert[i] == 0:
        wl[i] = min(wl[i], RED - 0.15)

# Pre-ramp hours before each labeled flood so flood rows can reach red without 1h cliffs
for idx in np.where(alert >= 1)[0]:
    need = RED + 0.10 + 0.14 * (alert[idx] - 1)
    steps = 0
    j = idx - 1
    while j >= 0 and steps < 14:
        if breaks[j + 1]:
            break
        req = need - (idx - j) * (FLOOD_RISE * 0.88)
        wl[j] = max(wl[j], req)
        steps += 1
        j -= 1
    if idx > 0 and not breaks[idx]:
        wl[idx] = max(wl[idx], min(need, wl[idx - 1] + FLOOD_RISE))
    else:
        wl[idx] = max(wl[idx], need)

# Re-apply forward rate limits after pre-ramp
for i in range(1, n):
    if breaks[i]:
        continue
    lim_r = FLOOD_RISE if alert[i] >= 1 or alert[i - 1] >= 1 or anticipate[i] > 0.3 else MAX_RISE
    lim_f = FLOOD_FALL if wl[i - 1] >= ORANGE else MAX_FALL
    d = wl[i] - wl[i - 1]
    if d > lim_r:
        wl[i] = wl[i - 1] + lim_r
    elif d < -lim_f:
        wl[i] = wl[i - 1] - lim_f
    if alert[i] == 0:
        wl[i] = min(wl[i], RED - 0.15)
    elif wl[i] < RED + 0.08:
        wl[i] = min(RED + 0.08 + 0.14 * (alert[i] - 1), wl[i - 1] + FLOOD_RISE)

# Guarantee labeled flood rows meet red band; spread onset backward at max FLOOD_RISE/h
for idx in np.where(alert >= 1)[0]:
    need = max(wl[idx], RED + 0.06 + 0.14 * (alert[idx] - 1))
    wl[idx] = need
    for k in range(1, 20):
        j = idx - k
        if j < 0 or breaks[j + 1]:
            break
        wl[j] = max(wl[j], wl[j + 1] - FLOOD_RISE)
        if alert[j] == 0:
            wl[j] = min(wl[j], RED - 0.12)

wl = np.round(wl, 3)
rise = np.zeros(n)
rise[1:] = np.diff(wl)
rise[breaks] = 0.0
rise = np.round(rise, 3)

df["water_level"] = wl
df["rise_rate"] = rise
df.to_csv(PATH, index=False)
print("Wrote", PATH)
