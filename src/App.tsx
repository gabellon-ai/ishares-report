useEffect(() => {
  (async () => {
    try {
      setLoading(true);
      setError(null);

      // funds.json lives at the web root because it's in /public
      const res = await fetch('/funds.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      const parsed: Fund[] = (json || []).map((r: any) => ({
        Ticker: r["Ticker"],
        "Fund Name": r["Fund Name"],
        "Closing Price": parseNum(r["Closing Price"]),
        "Average Yield to Maturity": parseNum(r["Average Yield to Maturity"]),
        "Weighted Avg Coupon": parseNum(r["Weighted Avg Coupon"]),
        "Effective Duration": parseNum(r["Effective Duration"]),
        "Weighted Avg Maturity": parseNum(r["Weighted Avg Maturity"]),
        "Option Adjusted Spread": parseNum(r["Option Adjusted Spread"]),
        Detail: r["Detail URL"] || r["Detail"] || undefined,
      }));

      setFunds(parsed);
    } catch (e: any) {
      console.error('Load error:', e);
      setError(e?.message || 'Failed to load funds.json');
    } finally {
      setLoading(false);
    }
  })();
}, []);

