import React, { useEffect, useMemo, useState } from "react";

/* ========= Types ========= */
type Fund = {
  Ticker: string;
  "Fund Name": string;
  "Closing Price"?: number;
  "Average Yield to Maturity"?: number; // %
  "Weighted Avg Coupon"?: number;       // %
  "Effective Duration"?: number;        // yrs
  "Weighted Avg Maturity"?: number;     // yrs
  "Option Adjusted Spread"?: number;    // bps
  Detail?: string;                      // URL
};

/* ========= Helpers ========= */
function parseNum(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const n = Number(
    String(raw)
      .replace(/\$/g, "")
      .replace(/%/g, "")
      .replace(/bps?/gi, "")
      .replace(/yrs?/gi, "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(n) ? n : undefined;
}

const fmtUsd = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(2)}`);
const fmtPct = (n?: number) => (n === undefined ? "—" : `${n.toFixed(2)}%`);
const fmtYrs = (n?: number) => (n === undefined ? "—" : `${n.toFixed(2)} yrs`);
const fmtBps = (n?: number) => (n === undefined ? "—" : `${n.toFixed(0)} bps`);

/* ========= App (default export) ========= */
export default function App() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // ---- Load data from /public/funds.json (served at site root) ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/funds.json", { cache: "no-store" });
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
        console.error("Load error:", e);
        setError(e?.message || "Failed to load funds.json");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- Simple search filter ----
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return funds;
    return funds.filter(
      (f) =>
        f.Ticker.toLowerCase().includes(query) ||
        (f["Fund Name"] || "").toLowerCase().includes(query)
    );
  }, [funds, q]);

  // ---- Quick stats ----
  const avgYtm = useMemo(() => {
    if (!filtered.length) return 0;
    const vals = filtered
      .map((f) => f["Average Yield to Maturity"])
      .filter((n): n is number => typeof n === "number");
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [filtered]);

  const avgDur = useMemo(() => {
    if (!filtered.length) return 0;
    const vals = filtered
      .map((f) => f["Effective Duration"])
      .filter((n): n is number => typeof n === "number");
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [filtered]);

  /* -------- Render -------- */
  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", padding: "16px" }}>
      <h1 style={{ marginBottom: 8 }}>Fixed Income Dashboard</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Data loaded from <code>/funds.json</code>
      </p>

      {/* Search */}
      <div style={{ margin: "12px 0" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ticker or name…"
          style={{ padding: 8, width: "100%", maxWidth: 360 }}
        />
      </div>

      {/* Status */}
      {loading && <div>Loading…</div>}
      {error && (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          Load error: {error}
        </div>
      )}

      {/* KPIs */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 16, margin: "8px 0 16px" }}>
          <div>
            <div style={{ color: "#666", fontSize: 12 }}>Total Funds</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{filtered.length}</div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: 12 }}>Avg. YTM</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{fmtPct(avgYtm)}</div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: 12 }}>Avg. Duration</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{fmtYrs(avgDur)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "8px 12px" }}>Ticker</th>
                <th style={{ padding: "8px 12px" }}>Fund Name</th>
                <th style={{ padding: "8px 12px" }}>Closing Price</th>
                <th style={{ padding: "8px 12px" }}>YTM</th>
                <th style={{ padding: "8px 12px" }}>Avg Coupon</th>
                <th style={{ padding: "8px 12px" }}>Eff. Duration</th>
                <th style={{ padding: "8px 12px" }}>Avg Maturity</th>
                <th style={{ padding: "8px 12px" }}>OAS</th>
                <th style={{ padding: "8px 12px" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.Ticker} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{f.Ticker}</td>
                  <td style={{ padding: "8px 12px" }}>{f["Fund Name"]}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtUsd(f["Closing Price"])}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtPct(f["Average Yield to Maturity"])}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtPct(f["Weighted Avg Coupon"])}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtYrs(f["Effective Duration"])}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtYrs(f["Weighted Avg Maturity"])}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtBps(f["Option Adjusted Spread"])}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {f.Detail ? (
                      <a href={f.Detail} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, color: "#777", fontSize: 12 }}>
        Source: iShares (scraped). For analysis only.
      </div>
    </div>
  );
}
