# ishares_fixed_income_scraper.py
# Requirements:
#   pip install selenium webdriver-manager pandas
#
# Usage (Spyder or terminal):
#   %runfile /home/david/DataWarehouse/Code/Production/untitled2.py --wdir
#   # then:
#   df

import time, re, pathlib, csv
from datetime import datetime

import pandas as pd

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

HOME = "https://www.ishares.com/us/products/etf-investments"
FAST_URL = (HOME + "#/?productView=etf&dataView=fixedIncomeView"
            "&sortColumn=totalNetAssets&sortDirection=desc")

# --------- Preferred directory (with fallback to CWD) ----------
PREFERRED_DIR = pathlib.Path("/home/david/DataWarehouse/Data/Program_Data")

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def make_driver(headless=True):
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
        prefs = {
            "profile.managed_default_content_settings.images": 2,
            "profile.default_content_setting_values.notifications": 2,
        }
        opts.add_experimental_option("prefs", prefs)
    opts.add_argument("--window-size=1400,900")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.page_load_strategy = "eager"
    # Anti-bot hardening
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
    try:
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        })
    except Exception:
        pass
    return driver

def safe_click(driver, candidates, timeout=10):
    for tup in candidates:
        if len(tup) == 3:
            by, sel, desc = tup
        elif len(tup) == 2:
            by, sel = tup; desc = sel
        else:
            continue
        try:
            el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, sel)))
            driver.execute_script("arguments[0].click()", el)
            return True, desc
        except Exception:
            continue
    return False, None

def accept_cookies_if_present(driver):
    safe_click(driver, [
        (By.ID, "onetrust-accept-btn-handler", "OneTrust accept"),
        (By.CSS_SELECTOR, "button[aria-label*='Accept' i]", "aria accept"),
        (By.XPATH, "//button[contains(translate(.,'ACCEPT','accept'),'accept')]", "generic accept"),
    ], timeout=4)

def open_filters_panel(driver):
    safe_click(driver, [
        (By.XPATH, "//button[contains(translate(.,'FILTER','filter'),'filter')]"),
        (By.CSS_SELECTOR, "button[data-automation-id*='filter']"),
        (By.XPATH, "//span[contains(translate(.,'FILTER','filter'),'filter')]/ancestor::button"),
    ], timeout=6)

def apply_asset_class_fixed_income(driver, expect_less_than=None):
    open_filters_panel(driver)
    safe_click(driver, [
        (By.XPATH, "//button[contains(translate(.,'ASSET CLASS','asset class'),'asset class')]"),
        (By.XPATH, "//div[contains(., 'Asset class')]/descendant::button[1]"),
        (By.CSS_SELECTOR, "[data-automation-id*='assetClass'] button"),
    ], timeout=6)
    clicked, _ = safe_click(driver, [
        (By.XPATH, "//label[.//span[contains(translate(.,'FIXED INCOME','fixed income'),'fixed income')]]"),
        (By.XPATH, "//input[@type='checkbox' and (translate(@value,'FIXED INCOME','fixed income')='fixed income' or translate(@aria-label,'FIXED INCOME','fixed income')='fixed income')]/ancestor::label"),
        (By.XPATH, "//span[contains(translate(.,'FIXED','fixed'),'fixed') and contains(translate(.,'INCOME','income'),'income')]/ancestor::label"),
    ], timeout=8)
    if not clicked:
        return False

    def count_rows():
        rows = driver.find_elements(By.CSS_SELECTOR, "[data-automation-id*='productRow'], [data-automation-id*='fund-row']")
        if not rows:
            rows = driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
        return len(rows)

    before = count_rows()
    target = expect_less_than if expect_less_than is not None else max(200, int(before * 0.7))

    try:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((
            By.XPATH,
            "//div[contains(@class,'chip') or contains(@data-automation-id,'chip')]"
            "[contains(translate(.,'FIXED','fixed'),'fixed') and contains(translate(.,'INCOME','income'),'income')]"
        )))
        chip_ok = True
    except Exception:
        chip_ok = False

    t0 = time.time()
    after = count_rows()
    while time.time() - t0 < 8:
        after = count_rows()
        if (chip_ok and after <= target) or (after <= target):
            break
        time.sleep(0.25)

    return (after <= target) or chip_ok

def click_show_all(driver):
    ok, _ = safe_click(driver, [
        (By.CSS_SELECTOR, "button[data-automation-id*='showAll']"),
        (By.CSS_SELECTOR, "a[data-automation-id*='showAll']"),
        (By.XPATH, "//button[contains(translate(.,'SHOW ALL','show all'),'show all')]"),
        (By.XPATH, "//a[contains(translate(.,'SHOW ALL','show all'),'show all')]"),
    ], timeout=5)
    if ok:
        log("Clicked Show all.")
    return ok

def wait_for_some_rows(driver, min_rows=50, max_wait=12):
    log(f"Waiting for at least {min_rows} rows…")
    t0 = time.time()
    rows = []
    while time.time() - t0 < max_wait and len(rows) < min_rows:
        rows = driver.find_elements(By.CSS_SELECTOR, "[data-automation-id*='productRow'], [data-automation-id*='fund-row']")
        if not rows:
            rows = driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
        if not rows:
            rows = driver.find_elements(By.CSS_SELECTOR, "[data-automation-id*='fund']")
        if len(rows) >= min_rows:
            break
        time.sleep(0.2)
    log(f"Detected {len(rows)} candidate rows.")
    return rows

def scrape_rows(rows):
    """Return list of dicts: [{"ticker":..., "name":..., "url":...}, ...]"""
    def clean(s): return " ".join((s or "").split())
    BLOCKLIST = {"ETF","ETFs","USD","NAV","US","U.S.","NEW","FIXED","INCOME","BOND",
                 "BONDS","TBILL","UCITS","ISHARES","ISHARE","FUND","FUNDS","USA"}
    data, seen = [], set()

    for r in rows:
        try:
            # NAME + URL
            name, url = "", ""
            for by, sel in [
                (By.CSS_SELECTOR, "[data-automation-id*='fundName'] a"),
                (By.XPATH, ".//a[contains(@href,'/us/products/')]"),
                (By.XPATH, ".//a[contains(@href,'/products/')]"),
            ]:
                try:
                    candidates = r.find_elements(by, sel)
                    if candidates:
                        link = max(candidates, key=lambda el: len(clean(el.text)))
                        name = clean(link.text)
                        url = link.get_attribute("href") or ""
                        break
                except Exception:
                    continue

            if not name:
                for by, sel in [
                    (By.XPATH, ".//h3|.//h4"),
                    (By.CSS_SELECTOR, ".fund-name, .name"),
                ]:
                    try:
                        el = r.find_element(by, sel)
                        name = clean(el.text)
                        url = el.get_attribute("href") or url
                        break
                    except Exception:
                        pass

            # TICKER
            ticker = ""
            for by, sel in [
                (By.CSS_SELECTOR, "[data-automation-id*='ticker']"),
                (By.CSS_SELECTOR, ".fund-ticker, .ticker"),
                (By.XPATH, ".//*[contains(@class,'ticker') or contains(@data-automation-id,'ticker')]"),
                (By.XPATH, ".//td[1]"),
            ]:
                try:
                    el = r.find_element(by, sel)
                    t = clean(el.text)
                    if 2 <= len(t) <= 5 and t.isupper():
                        ticker = t
                        break
                except Exception:
                    pass

            if not ticker:
                try:
                    txt = clean(r.text)
                    for m in re.finditer(r"\b[A-Z]{2,5}\b", txt):
                        t = m.group(0)
                        if t not in BLOCKLIST:
                            ticker = t
                            break
                except Exception:
                    pass

            if ticker and name:
                key = (ticker, name)
                if key not in seen:
                    data.append({"ticker": ticker, "name": name, "url": url})
                    seen.add(key)
        except Exception:
            continue
    return data

def save_html(driver, path="ishares_fixed_income_debug.html"):
    try:
        html = driver.page_source
        p = pathlib.Path(path).resolve()
        p.write_text(html, encoding="utf-8")
        log(f"Saved page HTML to {p}")
    except Exception as e:
        log(f"Failed to save HTML: {e}")

def scrape_fixed_income_list(headless=True):
    t_start = time.time()
    driver = make_driver(headless=headless)
    try:
        log("Navigating to fixed-income ETFs view…")
        driver.get(FAST_URL)
        accept_cookies_if_present(driver)
        click_show_all(driver)

        applied = apply_asset_class_fixed_income(driver, expect_less_than=300)
        if not applied:
            log("Filter didn’t register—retrying from base ETFs page…")
            driver.get(HOME + "#/?productView=etf&sortColumn=totalNetAssets&sortDirection=desc")
            accept_cookies_if_present(driver)
            click_show_all(driver)
            apply_asset_class_fixed_income(driver, expect_less_than=300)

        rows = wait_for_some_rows(driver, min_rows=50, max_wait=12)
        data = scrape_rows(rows)

        if not data:
            save_html(driver)

        if len(data) > 300:
            log(f"Row count {len(data)} still high—reapplying Fixed income filter…")
            apply_asset_class_fixed_income(driver, expect_less_than=300)
            rows = wait_for_some_rows(driver, min_rows=50, max_wait=8)
            data = scrape_rows(rows)

        log(f"Collected {len(data)} funds in {time.time() - t_start:.1f}s.")
        return data
    finally:
        driver.quit()

# --------- Metric extraction (per fund page) ---------
# NOTE: "Convexity" removed per your request.
METRIC_PATTERNS = {
    "Closing Price": [
        # Require a price-looking number with two decimals to avoid stray integers (e.g., "7")
        r"\bclosing\s+price\b.*?(\$?\d{1,3}(?:,\d{3})*\.\d{2})",
        r"\bmarket\s+price\b.*?(\$?\d{1,3}(?:,\d{3})*\.\d{2})",
        r"\blast\s+price\b.*?(\$?\d{1,3}(?:,\d{3})*\.\d{2})",
    ],
    "Average Yield to Maturity": [
        r"\byield\s+to\s+maturity\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
        r"\bavg(?:\.|erage)?\s+ytm\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
        r"\bytms?\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
        r"\byield\s+to\s+worst\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",   # captures YTW when used instead of YTM
        r"\bytws?\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
    ],
    "Weighted Avg Coupon": [
        r"\bweighted\s+avg(?:erage)?\s+coupon\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
        r"\baverage\s+coupon\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
        r"\bavg(?:\.|erage)?\s+coupon\b.*?([0-9]+(?:\.[0-9]+)?)\s*%",
    ],
    "Effective Duration": [
        r"\beffective\s+duration\b.*?([0-9]+(?:\.[0-9]+)?)\s*(?:yrs?|years?)\b",
        r"\beffective\s+duration\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\b",
    ],
    "Weighted Avg Maturity": [
        r"\bweighted\s+avg(?:erage)?\s+maturity\b.*?([0-9]+(?:\.[0-9]+)?)\s*(?:yrs?|years?)\b",
        r"\baverage\s+maturity\b.*?([0-9]+(?:\.[0-9]+)?)\s*(?:yrs?|years?)\b",
        r"\bavg(?:\.|erage)?\s+maturity\b.*?([0-9]+(?:\.[0-9]+)?)\s*(?:yrs?|years?)\b",
    ],
    "Option Adjusted Spread": [
        r"\boption\s+adjusted\s+spread\b.*?([0-9]+(?:\.[0-9]+)?)\s*(?:bp|bps)\b",
        r"\boas\b.*?([0-9]+(?:\.[0-9]+)?)\s*(?:bp|bps)\b",
        r"\boas\b.*?([0-9]+(?:\.[0-9]+)?)\b",
    ],
}

def _parse_number(s):
    if s is None:
        return None
    t = s.strip().replace(",", "").replace("\u00A0", " ")
    t = re.sub(r"^\$", "", t)
    t = t.replace("bp", "").replace("bps", "")
    t = t.replace("%", "")
    try:
        return float(t)
    except Exception:
        return None

def _extract_price_like(text):
    """Return a price-looking number with two decimals (e.g., $104.23 or 104.23)."""
    if not text:
        return None
    m = re.search(r"\$?\d{1,3}(?:,\d{3})*\.\d{2}", text)
    return m.group(0) if m else None

def get_closing_price_dom(driver):
    """
    DOM-first attempt to get Closing Price.
    Tries common iShares hooks and label-adjacent values, then returns a parsed float-compatible string.
    """
    candidates = [
        # class/id hooks seen on iShares details pages
        "[class*='closingPrice']",
        "[data-automation-id*='closingPrice']",
        "#fundamentalsAndRisk .col-closingPrice",
        ".col-closingPrice",
        # sometimes surfaced as Market Price (same value we want for 'closing price')
        "[class*='marketPrice']",
        "[data-automation-id*='marketPrice']",
    ]
    for sel in candidates:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            txt = el.text.strip()
            price = _extract_price_like(txt)
            if not price:
                # look for a numeric child
                child = el.find_element(By.XPATH, ".//span|.//div|.//dd")
                txt2 = child.text.strip()
                price = _extract_price_like(txt2)
            if price:
                return price
        except Exception:
            pass

    # Label-adjacent fallback: find 'Closing Price' and grab next sibling-ish text
    try:
        el = driver.find_element(By.XPATH, "//*[contains(translate(.,'CLOSING PRICE','closing price'),'closing price')]")
        # next sibling or nearby numeric
        for xp in ["following-sibling::*[1]", "parent::*/*[position()>1][1]", "ancestor::*[self::div or self::section][1]//*[self::div or self::span][1]"]:
            try:
                v = el.find_element(By.XPATH, xp).text.strip()
                price = _extract_price_like(v)
                if price:
                    return price
            except Exception:
                continue
    except Exception:
        pass

    return None

def extract_metrics_from_body_text(text):
    out = {k: None for k in METRIC_PATTERNS.keys()}
    if not text:
        return out
    low = text.lower()
    for key, pats in METRIC_PATTERNS.items():
        for pat in pats:
            m = re.search(pat, low, flags=re.DOTALL)
            if m:
                out[key] = _parse_number(m.group(1))
                break
    return out

def scrape_fund_metrics(driver, url, wait_secs=15):
    if not url:
        return {k: None for k in METRIC_PATTERNS.keys()}
    try:
        driver.get(url)
        WebDriverWait(driver, wait_secs).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(0.7)  # JS render
        body = driver.find_element(By.TAG_NAME, "body").text

        # Parse everything from text
        metrics = extract_metrics_from_body_text(body)

        # --- Closing Price (DOM-first) overrides/fills if missing ---
        closing_price_str = get_closing_price_dom(driver)
        if closing_price_str:
            metrics["Closing Price"] = _parse_number(closing_price_str)
        elif metrics.get("Closing Price") is None:
            # one more try after a short wait (lazy content)
            time.sleep(0.6)
            body = driver.find_element(By.TAG_NAME, "body").text
            fall = extract_metrics_from_body_text(body)
            if fall.get("Closing Price") is not None:
                metrics["Closing Price"] = fall["Closing Price"]

        # small second pass for Effective Duration if it came back None
        if metrics.get("Effective Duration") is None:
            time.sleep(0.4)
            body = driver.find_element(By.TAG_NAME, "body").text
            bump = extract_metrics_from_body_text(body)
            if bump.get("Effective Duration") is not None:
                metrics["Effective Duration"] = bump["Effective Duration"]

        return metrics
    except Exception:
        return {k: None for k in METRIC_PATTERNS.keys()}

def scrape_details_for_funds(fund_rows, headless=True, max_per_min=40):
    driver = make_driver(headless=headless)
    results = []
    per_req_sleep = max(0.0, 60.0/max_per_min)
    try:
        for i, row in enumerate(fund_rows, 1):
            url = row.get("url", "")
            ticker = row["ticker"]; name = row["name"]
            m = scrape_fund_metrics(driver, url)
            rec = {
                "Ticker": ticker,
                "Fund Name": name,
                "Closing Price": m["Closing Price"],
                "Average Yield to Maturity": m["Average Yield to Maturity"],
                "Weighted Avg Coupon": m["Weighted Avg Coupon"],
                "Effective Duration": m["Effective Duration"],
                "Weighted Avg Maturity": m["Weighted Avg Maturity"],
                "Option Adjusted Spread": m["Option Adjusted Spread"],
                "Detail URL": url,
            }
            results.append(rec)
            log(f"[{i}/{len(fund_rows)}] {ticker}: Close={rec['Closing Price']}  EffDur={rec['Effective Duration']} yrs  YTM={rec['Average Yield to Maturity']}%  OAS={rec['Option Adjusted Spread']} bps")
            time.sleep(per_req_sleep)
    finally:
        driver.quit()
    return results

# ----------------------- Save helpers -----------------------
def choose_save_dir():
    preferred_dir = PREFERRED_DIR
    fallback_dir = pathlib.Path.cwd()
    try:
        preferred_dir.mkdir(parents=True, exist_ok=True)
        test_file = preferred_dir / ".write_test"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink()
        save_dir = preferred_dir
        print(f"Saving to preferred directory: {save_dir}")
    except Exception as e:
        print(f"WARNING: Cannot write to preferred directory ({e}). Using current directory.")
        save_dir = fallback_dir
    return save_dir

def prune_old_timestamped_files(dir_path: pathlib.Path, stem: str, keep:int=5):
    files = sorted(
        dir_path.glob(f"{stem}_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    for old in files[keep:]:
        try:
            old.unlink()
            print(f"Pruned old file: {old}")
        except Exception as e:
            print(f"Could not delete {old}: {e}")

def write_csv(path: pathlib.Path, headers, rows_iterable):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(headers)
        for row in rows_iterable:
            w.writerow(row)

# ----------------------- Main (always details) -----------------------
if __name__ == "__main__":
    headless = True  # Spyder run: keep headless; flip to False for debugging if needed

    # 1) Scrape base list with URLs
    funds = scrape_fixed_income_list(headless=headless)
    print(f"Found {len(funds)} fixed income funds")
    for r in funds[:10]:
        print(f"{r['ticker']}\t{r['name']}  [{r.get('url','')}]")
    if len(funds) > 10:
        print(f"... ({len(funds)-10} more)")

    # 2) Save base list CSV
    save_dir = choose_save_dir()
    base_stem = "ishares_fixed_income"
    prune_old_timestamped_files(save_dir, base_stem, keep=5)
    base_file = save_dir / f"{base_stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    write_csv(
        base_file,
        headers=["Ticker", "Fund Name", "Detail URL"],
        rows_iterable=((r["ticker"], r["name"], r.get("url","")) for r in funds)
    )
    print(f"Saved base list to: {base_file.resolve()}")

    # 3) Always scrape details -> DataFrame `df` and CSV
    metrics_rows = scrape_details_for_funds(funds, headless=headless, max_per_min=40)

    # Create DataFrame in the exact order requested (Convexity removed)
    df = pd.DataFrame(metrics_rows, columns=[
        "Ticker",
        "Fund Name",
        "Closing Price",
        "Average Yield to Maturity",
        "Weighted Avg Coupon",
        "Effective Duration",
        "Weighted Avg Maturity",
        "Option Adjusted Spread",
        "Detail URL",
    ])

    # Preview + shape
    print(df.head(10).to_string(index=False))
    print(f"DataFrame shape: {df.shape}")

    # Save details CSV (keep only requested cols)
    details_stem = "ishares_fixed_income_metrics"
    details_file = save_dir / f"{details_stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    keep_cols = ["Ticker","Fund Name","Closing Price","Average Yield to Maturity",
                 "Weighted Avg Coupon","Effective Duration","Weighted Avg Maturity",
                 "Option Adjusted Spread"]
    df[keep_cols].to_csv(details_file, index=False)
    print(f"Saved metrics to: {details_file.resolve()}")
# ---- write JSON for the React app (robust) ----
def resolve_react_public_dir() -> pathlib.Path:
    """
    Resolve a React /public directory to write funds.json.

    Priority:
      1) Env var REACT_PUBLIC_DIR
      2) Known Windows project path (ishares-report/public)
      3) ~/ishares-report/public
      4) ./public next to where you run the script
    """
    # 1) Env override
    env_dir = pathlib.os.getenv("REACT_PUBLIC_DIR")
    if env_dir:
        p = pathlib.Path(env_dir).expanduser().resolve()
        return p

    # 2) Your Windows project path (raw string to avoid unicodeescape)
    candidates = [
        pathlib.Path(r"C:\Users\Bello\ishares-report\public"),
        pathlib.Path.home() / "ishares-report" / "public",
        pathlib.Path.cwd() / "public",
    ]
    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p.resolve()
        except Exception:
            continue

    # Fallback to CWD/public
    return (pathlib.Path.cwd() / "public").resolve()


if __name__ == "__main__":
    # ... all your scraping / dataframe creation code above ...

    public_dir = resolve_react_public_dir()
    public_dir.mkdir(parents=True, exist_ok=True)
    json_path = public_dir / "funds.json"

    # Save JSON with pretty formatting for readability
    df.to_json(json_path, orient="records")
    print(f"\n✅ Wrote JSON for React to: {json_path}\n")
