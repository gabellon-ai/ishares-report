"""
batch_export_json.py
Runs the iShares fixed-income scraper and writes a JSON file for the site:
  ./public/funds.json

Usage (local):
  python batch_export_json.py --limit 25 --headless true --max-per-min 40

Env vars (CI friendly):
  LIMIT=25 HEADLESS=true MAX_PER_MIN=40 python batch_export_json.py
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
from typing import List, Dict, Any

# ⬇️ your scraper module must be in the same folder as this file
import ishares_fixed_income_scraper as scr


NUM_FIELDS = [
    "Closing Price",
    "Average Yield to Maturity",
    "Weighted Avg Coupon",
    "Effective Duration",
    "Weighted Avg Maturity",
    "Option Adjusted Spread",
]


def _parse_bool(x: str | bool | None, default: bool) -> bool:
    if isinstance(x, bool):
        return x
    if x is None:
        return default
    return str(x).strip().lower() in {"1", "true", "t", "yes", "y"}


def export_json(
    out_path: pathlib.Path,
    *,
    limit: int | None = None,
    headless: bool = True,
    max_per_min: int = 40,
) -> List[Dict[str, Any]]:
    """Scrape funds + details and write a compact JSON array to out_path."""
    print(f"[batch] headless={headless}  max_per_min={max_per_min}  limit={limit or 'ALL'}")

    funds = scr.scrape_fixed_income_list(headless=headless)
    if limit:
        funds = funds[: int(limit)]
    print(f"[batch] base fund count: {len(funds)}")

    rows = scr.scrape_details_for_funds(funds, headless=headless, max_per_min=max_per_min)
    print(f"[batch] detailed rows: {len(rows)}")

    # Round numeric fields a bit to keep diffs small in Git commits
    for r in rows:
        for k in NUM_FIELDS:
            v = r.get(k)
            if isinstance(v, float):
                r[k] = round(v, 4)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Write as a plain array (frontend can fetch('/funds.json') and setRows(json))
    out_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"[batch] wrote {out_path.resolve()} ({len(rows)} records)")
    return rows


def main():
    default_out = pathlib.Path(__file__).resolve().parent / "public" / "funds.json"

    ap = argparse.ArgumentParser(description="Export iShares fixed-income metrics to public/funds.json")
    ap.add_argument("--limit", type=int, default=None, help="Scrape only the first N funds (for faster runs)")
    ap.add_argument("--headless", type=str, default=None, help="true/false (defaults to true)")
    ap.add_argument("--max-per-min", type=int, default=40, help="Throttle detail requests per minute")
    ap.add_argument("--out", type=str, default=str(default_out), help="Output path (default: public/funds.json)")
    args = ap.parse_args()

    # Allow env vars to override/define flags (nice for GitHub Actions)
    limit = int(os.getenv("LIMIT")) if os.getenv("LIMIT", "").strip() else args.limit
    headless = _parse_bool(os.getenv("HEADLESS") or args.headless, True)
    max_per_min = int(os.getenv("MAX_PER_MIN") or args.max_per_min)
    out_path = pathlib.Path(os.getenv("OUT") or args.out)

    rows = export_json(out_path, limit=limit, headless=headless, max_per_min=max_per_min)
    if not rows:
        raise SystemExit("No rows were scraped; failing the job so the workflow shows red.")


if __name__ == "__main__":
    main()
