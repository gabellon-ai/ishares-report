import React, { useEffect, useState } from "react";

type Fund = {
  Ticker: string;
  "Fund Name": string;
  "Closing Price"?: number;
  "Average Yield to Maturity"?: number;
  "Weighted Avg Coupon"?: number;
  "Effective Duration"?: number;
  "Weighted Avg Maturity"?: number;
  "Option Adjusted Spread"?: number;
  Detail?: string;
};

export default function App() {
  const [rows, setRows] = useState<Fund[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await fetch("/funds.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Fund[];
        setRows(data ?? []);
      } catch (e: any) {
        setError(e?.message || "Failed to load funds.json");
      }
    })();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, color: "#b91c1c", fontFamily: "system-ui" }}>
        <h1>Load error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 12 }}>iShares Report</h1>
      <div>Loaded <strong>{rows.length}</strong> rows from <code>/funds.json</code>.</div>
      <ul style={{ marginTop: 12 }}>
        {rows.slice(0, 5).map((r) => (
          <li key={r.Ticker}>
            {r.Ticker} — {r["Fund Name"]}
          </li>
        ))}
      </ul>
    </div>
  );
}
