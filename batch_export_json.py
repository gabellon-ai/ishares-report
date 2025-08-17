# batch_export_json.py
# Convert the latest CSV from the scraper into public/funds.json (all rows)
import json, pathlib, re, os
import pandas as pd

ROOT = pathlib.Path(__file__).parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

def latest_metrics_csv():
    files = sorted(
        ROOT.glob("ishares_fixed_income_metrics_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        raise SystemExit("No metrics CSV found. Make sure the scraper step ran.")
    return files[0]

_num_tail = re.compile(r"\s*(%|bps?|yrs?)\s*$", re.I)
def to_number(v):
    if pd.isna(v): return None
    t = str(v).strip().replace("$", "").replace(",", "")
    t = _num_tail.sub("", t)
    try:
        return float(t)
    except Exception:
        return None

def main(limit=None):
    csv_path = latest_metrics_csv()
    df = pd.read_csv(csv_path)

    rows = []
    for _, r in df.iterrows():
        rows.append({
            "Ticker": r.get("Ticker"),
            "Fund Name": r.get("Fund Name"),
            "Closing Price": to_number(r.get("Closing Price")),
            "Average Yield to Maturity": to_number(r.get("Average Yield to Maturity")),
            "Weighted Avg Coupon": to_number(r.get("Weighted Avg Coupon")),
            "Effective Duration": to_number(r.get("Effective Duration")),
            "Weighted Avg Maturity": to_number(r.get("Weighted Avg Maturity")),
            "Option Adjusted Spread": to_number(r.get("Option Adjusted Spread")),
            "Detail": r.get("Detail URL") or r.get("Detail") or None,
        })

    if limit:
        rows = rows[:limit]

    out = PUBLIC / "funds.json"
    out.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} rows -> {out}")

if __name__ == "__main__":
    # Optional: MAX_FUNDS=100 to cap during testing; unset for all.
    lim = os.getenv("MAX_FUNDS")
    lim = int(lim) if (lim and lim.isdigit()) else None
    main(limit=lim)
