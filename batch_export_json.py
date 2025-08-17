#!/usr/bin/env python3
from pathlib import Path
import json
import pandas as pd
import sys

# Always work relative to this file, not the runner's CWD
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
PUBLIC_DIR = ROOT / "public"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

print(f"[export] ROOT     : {ROOT}")
print(f"[export] DATA_DIR : {DATA_DIR}")
print(f"[export] PUBLIC   : {PUBLIC_DIR}")

# Find the newest metrics CSV produced by the scraper
csvs = sorted(DATA_DIR.glob("ishares_fixed_income_metrics_*.csv"))
if not csvs:
    listing = [p.name for p in DATA_DIR.glob("*")]
    print(f"[export] No metrics CSV found in {DATA_DIR}. Listing: {listing}")
    sys.exit(1)

latest = csvs[-1]
print(f"[export] Using CSV : {latest.name}")

# Load and select columns
keep_cols = [
    "Ticker",
    "Fund Name",
    "Closing Price",
    "Average Yield to Maturity",
    "Weighted Avg Coupon",
    "Effective Duration",
    "Weighted Avg Maturity",
    "Option Adjusted Spread",
    "Detail URL",
]
df = pd.read_csv(latest)

missing = [c for c in keep_cols if c not in df.columns]
if missing:
    print(f"[export] Missing columns (ok, will drop): {missing}")
use_cols = [c for c in keep_cols if c in df.columns]

# Write public/funds.json (rename detail key to 'Detail' for the UI)
records = (
    df[use_cols]
    .rename(columns={"Detail URL": "Detail"})
    .to_dict(orient="records")
)
out_path = PUBLIC_DIR / "funds.json"
out_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
print(f"[export] Wrote {len(records)} rows -> {out_path}")
