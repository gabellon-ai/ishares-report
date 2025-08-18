# batch_export_json.py
# Reads the newest CSV from ./data and writes ./public/funds.json as a FLAT ARRAY.

import csv, json, sys, pathlib

METRICS_DIR = pathlib.Path("data")                 # where the scraper saves CSVs
OUT_PATH    = pathlib.Path("public/funds.json")    # app reads this file

def _num(s):
    if s is None: return None
    s = str(s).strip()
    if s == "": return None
    try: return float(s)
    except: return None

def find_latest_csv():
    # prefer ./data; fall back to repo root in case the CSV landed there
    cands = sorted(METRICS_DIR.glob("ishares_fixed_income_metrics_*.csv"))
    if not cands:
        cands = sorted(pathlib.Path(".").glob("ishares_fixed_income_metrics_*.csv"))
    return cands[-1] if cands else None

def convert(csv_path: pathlib.Path):
    rows = []
    with csv_path.open("r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for rec in r:
            rows.append({
                "Ticker": rec.get("Ticker",""),
                "Fund Name": rec.get("Fund Name",""),
                "Closing Price": _num(rec.get("Closing Price")),
                "Average Yield to Maturity": _num(rec.get("Average Yield to Maturity")),
                "Weighted Avg Coupon": _num(rec.get("Weighted Avg Coupon")),
                "Effective Duration": _num(rec.get("Effective Duration")),
                "Weighted Avg Maturity": _num(rec.get("Weighted Avg Maturity")),
                "Option Adjusted Spread": _num(rec.get("Option Adjusted Spread")),
                "Detail": rec.get("Detail URL") or rec.get("Detail",""),
            })
    return rows

def main():
    csv_path = find_latest_csv()
    if not csv_path:
        print("No metrics CSV found. Make sure the scraper step ran.", file=sys.stderr)
        sys.exit(1)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = convert(csv_path)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"Wrote {len(data)} records to {OUT_PATH}")

if __name__ == "__main__":
    main()
