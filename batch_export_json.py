"""
batch_export_json.py

Reads the newest CSV from ./data named:
  ishares_fixed_income_metrics_*.csv
and writes:
  ./public/funds.json
  ./public/last_updated.json   <-- adds timestamp + row count
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
PUBLIC_DIR = ROOT / "public"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

KEEP_COLS = [
    "Ticker",
    "Fund Name",
    "Closing Price",
    "Average Yield to Maturity",
    "Weighted Avg Coupon",
    "Effective Duration",
    "Weighted Avg Maturity",
    "Option Adjusted Spread",
    "Detail URL",  # keep so the app can render the "View" link
]


def find_latest_metrics_csv() -> Path:
    candidates = sorted(
        DATA_DIR.glob("ishares_fixed_income_metrics_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError("No metrics CSV found in ./data/")
    return candidates[0]


def export_json_from_csv(csv_path: Path) -> tuple[Path, Path, int]:
    df = pd.read_csv(csv_path)
    # keep only expected columns if present
    cols = [c for c in KEEP_COLS if c in df.columns]
    if cols:
        df = df[cols]

    funds_path = PUBLIC_DIR / "funds.json"
    funds_path.write_text(df.to_json(orient="records", indent=2), encoding="utf-8")

    meta = {
        "updated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "rows": int(df.shape[0]),
        "source_file": csv_path.name,
    }
    meta_path = PUBLIC_DIR / "last_updated.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Wrote {funds_path} ({df.shape[0]} rows)")
    print(f"Wrote {meta_path} ({meta['updated_at']})")
    return funds_path, meta_path, int(df.shape[0])


if __name__ == "__main__":
    latest = find_latest_metrics_csv()
    print(f"Using CSV: {latest}")
    export_json_from_csv(latest)
