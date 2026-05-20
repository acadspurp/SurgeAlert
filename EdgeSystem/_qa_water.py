"""Deep QA for water_level and rise_rate."""
import numpy as np
import pandas as pd

PATH = r"C:\Surge\SurgeAlert\EdgeSystem\Dataset.csv"
YELLOW, ORANGE, RED = 3.50, 4.50, 5.50

df = pd.read_csv(PATH)
n = len(df)

def band(wl):
    if wl < YELLOW:
        return 0
    if wl < ORANGE:
        return 1
    if wl < RED:
        return 2
    return 3

df["band"] = df["water_level"].apply(band)
hd = df["Hour"].diff()
md = df["Month"].diff()
brk = ((hd < -20) | (hd > 5) | (md != 0)).to_numpy()
cont = ~brk

fails = []

# rise_rate consistency
for i in range(1, n):
    if brk[i]:
        if df.rise_rate.iloc[i] != 0:
            fails.append("rise_rate nonzero at break")
            break
    elif abs(df.rise_rate.iloc[i] - (df.water_level.iloc[i] - df.water_level.iloc[i - 1])) > 0.002:
        fails.append("rise_rate != delta wl")
        break

c0_red = ((df.Target_Alert_Class == 0) & (df.water_level >= RED)).sum()
flood_low = ((df.Target_Alert_Class >= 1) & (df.water_level < RED)).sum()
if c0_red:
    fails.append(f"class0 at red: {c0_red}")
if flood_low:
    fails.append(f"flood below red: {flood_low}")

# Red -> Green in 1h
for i in range(1, n):
    if not cont[i]:
        continue
    if df.band.iloc[i - 1] == 3 and df.band.iloc[i] == 0:
        fails.append(f"Red->Green 1h at row {i}")

# drop >=2 bands in 1h
for i in range(1, n):
    if not cont[i]:
        continue
    if df.band.iloc[i - 1] - df.band.iloc[i] >= 2:
        fails.append(f"2+ band drop 1h at row {i}")

# big jumps
jumps = []
for i in range(1, n):
    if not cont[i]:
        continue
    d = abs(df.water_level.iloc[i] - df.water_level.iloc[i - 1])
    if d > 0.45:
        jumps.append((i, d, int(df.Target_Alert_Class.iloc[i - 1]), int(df.Target_Alert_Class.iloc[i])))
if jumps:
    fails.append(f"jumps >0.45m/h: {len(jumps)} (e.g. {jumps[:3]})")

# flood then immediate crash while still labeled flood
for i in range(1, n):
    if not cont[i]:
        continue
    if df.Target_Alert_Class.iloc[i] >= 1 and df.rise_rate.iloc[i] < -0.35:
        fails.append(f"big fall during flood label row {i}")

# isolated flood labels
flood_i = np.where(df.Target_Alert_Class >= 1)[0]
iso = 0
for k in flood_i:
    prev_f = k > 0 and df.Target_Alert_Class.iloc[k - 1] >= 1 and not brk[k]
    next_f = k < n - 1 and df.Target_Alert_Class.iloc[k + 1] >= 1 and not brk[k + 1]
    if not prev_f and not next_f:
        iso += 1

print("=" * 55)
print("QA REPORT:", PATH)
print("=" * 55)
print(f"Rows: {n}")
print(f"rise_rate/delta: {'PASS' if not any('rise' in f or 'delta' in f for f in fails) else 'FAIL'}")
print(f"class0 vs red: {c0_red} | flood below red: {flood_low}")
print(f"Red->Green 1h: {sum(1 for f in fails if 'Red->Green' in f)}")
print(f"2+ band drops 1h: {sum(1 for f in fails if 'band drop' in f)}")
print(f"Jumps >0.45 m/h: {len(jumps)}")
print(f"Isolated flood labels: {iso} / {len(flood_i)}")
print(f"Corr wl-tide: {df.water_level.corr(df.Tide_Height_m):.3f}")
print(f"Corr rise-tide_diff: {df.rise_rate.corr(df.Tide_Height_m.diff()):.3f}")
c0 = df[df.Target_Alert_Class == 0]
print(f"Class0 bands: Green={(c0.band==0).sum()} Yellow={(c0.band==1).sum()} Orange={(c0.band==2).sum()}")
print(df.groupby("Target_Alert_Class")["water_level"].agg(["min", "mean", "max"]).round(3))
print("\nOverall:", "PASS" if not fails else "FAIL")
for f in fails[:12]:
    print(" -", f)
