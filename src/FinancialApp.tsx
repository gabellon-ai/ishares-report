import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, BarChart2, Clock } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart as ReBarChart,
  Bar,
} from "recharts";

type Fund = {
  Ticker: string;
  "Fund Name": string;
  "Closing Price"?: number;
  "Average Yield to Maturity"?: number; // %
  "Weighted Avg Coupon"?: number; // %
  "Effective Duration"?: number; // yrs
  "Weighted Avg Maturity"?: number; // yrs
  "Option Adjusted Spread"?: number; // bps
  Detail?: string; // URL
};

type SortKey =
  | "Ticker"
  | "Fund Name"
  | "Closing Price"
  | "Average Yield to Maturity"
  | "Weighted Avg Coupon"
  | "Effective Duration"
  | "Weighted Avg Maturity"
  | "Option Adjusted Spread";

function parseNum(raw: any): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return isFinite(raw) ? raw : undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const cleaned = s
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/bps?/gi, "")
    .replace(/yrs?/gi, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(cleaned);
  return isFinite(n) ? n : undefined;
}

function formatPct(n?: number) {
  if (n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}
function formatYears(n?: number) {
  if (n === undefined) return "—";
  return `${n.toFixed(2)} yrs`;
}
function formatBps(n?: number) {
  if (n === undefined) return "—";
  return `${n.toFixed(2)} bps`;
}
function formatUsd(n?: number) {
  if (n === undefined) return "—";
  return `$${n.toFixed(2)}`;
}

const NUMBER_INPUT =
  "w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500";

const FinancialApp: React.FC = () => {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [ytmMin, setYtmMin] = useState<number | undefined>();
  const [ytmMax, setYtmMax] = useState<number | undefined>();
  const [durMin, setDurMin] = useState<number | undefined>();
  const [durMax, setDurMax] = useState<number | undefined>();
  const [oasMin, setOasMin] = useState<number | undefined>();
  const [oasMax, setOasMax] = useState<number | undefined>();

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("Average Yield to Maturity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Chart tab
  const [tab, setTab] = useState<"scatter" | "ytm" | "duration">("scatter");

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
          Detail: r["Detail"],
        }));
        setFunds(parsed);
      } catch (e: any) {
        setError(e?.message || "Failed to load funds.json");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredFunds = useMemo(() => {
    const query = q.trim().toLowerCase();
    return funds
      .filter((f) =>
        query
          ? f.Ticker.toLowerCase().includes(query) ||
            f["Fund Name"]?.toLowerCase().includes(query)
          : true
      )
      .filter((f) =>
        ytmMin !== undefined ? (f["Average Yield to Maturity"] ?? -Infinity) >= ytmMin : true
      )
      .filter((f) =>
        ytmMax !== undefined ? (f["Average Yield to Maturity"] ?? Infinity) <= ytmMax : true
      )
      .filter((f) =>
        durMin !== undefined ? (f["Effective Duration"] ?? -Infinity) >= durMin : true
      )
      .filter((f) =>
        durMax !== undefined ? (f["Effective Duration"] ?? Infinity) <= durMax : true
      )
      .filter((f) =>
        oasMin !== undefined ? (f["Option Adjusted Spread"] ?? -Infinity) >= oasMin : true
      )
      .filter((f) =>
        oasMax !== undefined ? (f["Option Adjusted Spread"] ?? Infinity) <= oasMax : true
      );
  }, [funds, q, ytmMin, ytmMax, durMin, durMax, oasMin, oasMax]);

  const sortedFunds = useMemo(() => {
    const arr = [...filteredFunds];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      // string vs number safe compare
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = typeof av === "number" ? av : -Infinity;
      const bn = typeof bv === "number" ? bv : -Infinity;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [filteredFunds, sortKey, sortDir]);

  const avgYtm = useMemo(() => {
    if (!filteredFunds.length) return 0;
    return (
      filteredFunds.reduce((s, f) => s + (f["Average Yield to Maturity"] ?? 0), 0) /
      filteredFunds.length
    );
  }, [filteredFunds]);

  const avgDuration = useMemo(() => {
    if (!filteredFunds.length) return 0;
    return (
      filteredFunds.reduce((s, f) => s + (f["Effective Duration"] ?? 0), 0) /
      filteredFunds.length
    );
  }, [filteredFunds]);

  // Distributions
  function makeBins(values: number[], step: number) {
    if (!values.length) return [] as { bucket: string; count: number }[];
    const min = Math.floor(Math.min(...values) / step) * step;
    const max = Math.ceil(Math.max(...values) / step) * step;
    const bins: { bucket: string; count: number }[] = [];
    for (let x = min; x <= max; x += step) {
      const next = x + step;
      const count = values.filter((v) => v >= x && v < next).length;
      bins.push({ bucket: `${x.toFixed(1)}–${next.toFixed(1)}`, count });
    }
    return bins;
  }

  const ytmBins = useMemo(
    () =>
      makeBins(
        filteredFunds
          .map((f) => f["Average Yield to Maturity"])
          .filter((n): n is number => typeof n === "number"),
        0.5
      ),
    [filteredFunds]
  );

  const durBins = useMemo(
    () =>
      makeBins(
        filteredFunds
          .map((f) => f["Effective Duration"])
          .filter((n): n is number => typeof n === "number"),
        1
      ),
    [filteredFunds]
  );

  function exportCsv() {
    const cols: SortKey[] = [
      "Ticker",
      "Fund Name",
      "Closing Price",
      "Average Yield to Maturity",
      "Weighted Avg Coupon",
      "Effective Duration",
      "Weighted Avg Maturity",
      "Option Adjusted Spread",
    ];
    const header = cols.join(",");
    const rows = sortedFunds.map((f) =>
      [
        f.Ticker,
        `"${(f["Fund Name"] || "").replace(/"/g, '""')}"`,
        f["Closing Price"] ?? "",
        f["Average Yield to Maturity"] ?? "",
        f["Weighted Avg Coupon"] ?? "",
        f["Effective Duration"] ?? "",
        f["Weighted Avg Maturity"] ?? "",
        f["Option Adjusted Spread"] ?? "",
      ].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "funds_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const ChartTabs = (
    <div className="inline-flex rounded-xl bg-slate-200 p-1">
      {[
        { id: "scatter", label: "Scatter" },
        { id: "ytm", label: "YTM Dist" },
        { id: "duration", label: "Duration Dist" },
      ].map((t) => {
        const active = tab === (t.id as any);
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={
              "px-3 py-1 rounded-lg text-sm font-medium transition " +
              (active ? "bg-white text-slate-900 shadow" : "text-slate-700 hover:bg-white/70")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Fixed Income Dashboard</CardTitle>
          <p className="text-white/90 text-sm">
            Explore fixed income ETFs: search, filter, visualise and export the data scraped from
            iShares.
          </p>
        </CardHeader>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/15 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <div className="text-slate-500 text-sm">Total Funds</div>
              <div className="text-2xl font-semibold">{filteredFunds.length}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-2xl bg-violet-600/15 flex items-center justify-center">
              <BarChart2 className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <div className="text-slate-500 text-sm">Avg. YTM</div>
              <div className="text-2xl font-semibold">{formatPct(avgYtm)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-2xl bg-fuchsia-600/15 flex items-center justify-center">
              <Clock className="h-6 w-6 text-fuchsia-600" />
            </div>
            <div>
              <div className="text-slate-500 text-sm">Avg. Duration</div>
              <div className="text-2xl font-semibold">{formatYears(avgDuration)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Ticker or name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>YTM Min (%)</Label>
                <input
                  className={NUMBER_INPUT}
                  inputMode="decimal"
                  value={ytmMin ?? ""}
                  onChange={(e) => setYtmMin(parseNum(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>YTM Max (%)</Label>
                <input
                  className={NUMBER_INPUT}
                  inputMode="decimal"
                  value={ytmMax ?? ""}
                  onChange={(e) => setYtmMax(parseNum(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Dur Min (yrs)</Label>
                <input
                  className={NUMBER_INPUT}
                  inputMode="decimal"
                  value={durMin ?? ""}
                  onChange={(e) => setDurMin(parseNum(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Dur Max (yrs)</Label>
                <input
                  className={NUMBER_INPUT}
                  inputMode="decimal"
                  value={durMax ?? ""}
                  onChange={(e) => setDurMax(parseNum(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>OAS Min (bps)</Label>
                <input
                  className={NUMBER_INPUT}
                  inputMode="decimal"
                  value={oasMin ?? ""}
                  onChange={(e) => setOasMin(parseNum(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>OAS Max (bps)</Label>
                <input
                  className={NUMBER_INPUT}
                  inputMode="decimal"
                  value={oasMax ?? ""}
                  onChange={(e) => setOasMax(parseNum(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-slate-500">{filteredFunds.length} results</div>
              <Button variant="secondary" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card className="rounded-2xl shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Analytics</CardTitle>
            {ChartTabs}
          </CardHeader>
          <CardContent className="h-[360px]">
            {tab === "scatter" && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis
                    dataKey="x"
                    name="Duration"
                    unit=" yrs"
                    type="number"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />
                  <YAxis
                    dataKey="y"
                    name="YTM"
                    unit="%"
                    type="number"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />
                  <ZAxis dataKey="z" range={[60, 400]} />
                  <Tooltip
                    formatter={(val: any, name: string) => {
                      if (name === "y") return [formatPct(val), "YTM"];
                      if (name === "x") return [formatYears(val), "Duration"];
                      if (name === "z") return [formatBps(val), "OAS"];
                      return [val, name];
                    }}
                    labelFormatter={(lbl: any, p: any) => p && p.payload?.ticker}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Scatter
                    name="Funds"
                    data={filteredFunds
                      .filter(
                        (f) =>
                          f["Average Yield to Maturity"] !== undefined &&
                          f["Effective Duration"] !== undefined
                      )
                      .map((f) => ({
                        x: f["Effective Duration"],
                        y: f["Average Yield to Maturity"],
                        z: f["Option Adjusted Spread"] ?? 0,
                        ticker: f.Ticker,
                      }))}
                    fill="#6366f1" // indigo-500
                    stroke="#4338ca" // indigo-700
                    opacity={0.85}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {tab === "ytm" && (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={ytmBins} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#22c55e" /> {/* green-500 */}
                </ReBarChart>
              </ResponsiveContainer>
            )}

            {tab === "duration" && (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={durBins} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#475569" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#f59e0b" /> {/* amber-500 */}
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Fund Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                {(
                  [
                    "Ticker",
                    "Fund Name",
                    "Closing Price",
                    "Average Yield to Maturity",
                    "Weighted Avg Coupon",
                    "Effective Duration",
                    "Weighted Avg Maturity",
                    "Option Adjusted Spread",
                    "Detail",
                  ] as const
                ).map((col) => (
                  <th
                    key={col}
                    className="py-2 pr-4 whitespace-nowrap cursor-pointer select-none"
                    onClick={() => {
                      if (col === "Detail") return;
                      const key = col as SortKey;
                      if (sortKey === key) {
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setSortKey(key);
                        setSortDir("desc");
                      }
                    }}
                  >
                    {col}
                    {sortKey === col && (sortDir === "asc" ? " ▲" : " ▼")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedFunds.map((f) => (
                <tr key={f.Ticker} className="hover:bg-slate-50">
                  <td className="py-2 pr-4 whitespace-nowrap font-medium">{f.Ticker}</td>
                  <td className="py-2 pr-4">{f["Fund Name"]}</td>
                  <td className="py-2 pr-4">{formatUsd(f["Closing Price"])}</td>
                  <td className="py-2 pr-4">{formatPct(f["Average Yield to Maturity"])}</td>
                  <td className="py-2 pr-4">{formatPct(f["Weighted Avg Coupon"])}</td>
                  <td className="py-2 pr-4">{formatYears(f["Effective Duration"])}</td>
                  <td className="py-2 pr-4">{formatYears(f["Weighted Avg Maturity"])}</td>
                  <td className="py-2 pr-4">{formatBps(f["Option Adjusted Spread"])}</td>
                  <td className="py-2 pr-0">
                    {f.Detail ? (
                      <a
                        href={f.Detail}
                        className="text-indigo-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
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
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 pb-6">
        Data source: iShares (scraped). Visualization for internal analysis only.
      </div>
    </div>
  );
};

export default FinancialApp;
