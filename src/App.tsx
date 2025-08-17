// App.tsx
// Drop this in src/App.tsx (Vercel + Vite). It renders your full dashboard
// and loads data from /funds.json that your GitHub Action writes to /public.

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, BarChart2, Clock, Sun, Moon } from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Legend,
  BarChart as RBarChart,
  Bar,
} from "recharts";

/* ======================= Types & helpers ======================= */

type Fund = {
  Ticker: string;
  "Fund Name": string;
  "Closing Price"?: number;
  "Average Yield to Maturity"?: number; // %
  "Weighted Avg Coupon"?: number; // %
  "Effective Duration"?: number; // yrs
  "Weighted Avg Maturity"?: number; // yrs
  "Option Adjusted Spread"?: number; // bps
  Detail?: string; // mapped from "Detail URL"
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

function parseNum(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const n = Number(
    s
      .replace(/\$/g, "")
      .replace(/%/g, "")
      .replace(/bps?/gi, "")
      .replace(/yrs?/gi, "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(n) ? n : undefined;
}

const fmtPct = (n?: number) => (n === undefined ? "—" : `${n.toFixed(2)}%`);
const fmtYrs = (n?: number) => (n === undefined ? "—" : `${n.toFixed(2)} yrs`);
const fmtBps = (n?: number) => (n === undefined ? "—" : `${n.toFixed(2)} bps`);
const fmtUsd = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(2)}`);

/* ======================== Theme utilities ===================== */

function useIsDark() {
  const get = () =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const [isDark, setIsDark] = useState(get);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setIsDark(get()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function ThemeToggle() {
  const isDark = useIsDark();
  const toggle = () => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (isDark) {
      el.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      el.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };
  return (
    <Button
      onClick={toggle}
      title="Toggle theme"
      className="rounded-xl bg-white/20 hover:bg-white/30 text-white dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100"
      variant="ghost"
      size="sm"
    >
      {isDark ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
      {isDark ? "Dark" : "Light"}
    </Button>
  );
}

/* ========================= Number Stepper ===================== */

type StepperProps = {
  label: string;
  value?: number;
  setValue: (n: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string; // "%", "yrs", "bps"
  disabled?: boolean;
};

function NumberStepper({
  label,
  value,
  setValue,
  step = 1,
  min,
  max,
  suffix,
  disabled,
}: StepperProps) {
  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : n;
  };

  const change = (delta: number) => {
    const base = value ?? (min ?? 0);
    setValue(clamp(base + delta));
  };

  const onChange = (v: string) => {
    if (v === "") return setValue(undefined);
    const n = Number(v);
    setValue(Number.isFinite(n) ? clamp(n) : undefined);
  };

  const clear = () => setValue(undefined);

  return (
    <div className="space-y-1">
      <Label className="flex items-center justify-between">
        <span>{label}</span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="text-xs text-slate-500 hover:underline"
        >
          clear
        </button>
      </Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-9"
          onClick={() => change(-step)}
          disabled={disabled}
        >
          –
        </Button>
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-center"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          className="h-9 w-9"
          onClick={() => change(step)}
          disabled={disabled}
        >
          +
        </Button>
        {suffix ? (
          <span className="text-slate-500 text-sm">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ============================== App =========================== */

const App: React.FC = () => {
  // Data
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
  const [sortKey, setSortKey] =
    useState<SortKey>("Average Yield to Maturity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Charts
  const [tab, setTab] = useState<"scatter" | "ytm" | "duration">("scatter");
  const isDark = useIsDark();
  const axisColor = isDark ? "#E5E7EB" : "#0F172A";
  const gridColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const dotFill = isDark ? "#93C5FD" : "#1D4ED8";
  const dotStroke = isDark ? "#60A5FA" : "#1E40AF";
  const ytmBar = isDark ? "#34D399" : "#22C55E";
  const durBar = "#F59E0B";

  /* ------------------------- Fetch data ------------------------ */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Build a robust URL that works on Vercel and locally
        const jsonUrl =
          new URL("funds.json", import.meta.env.BASE_URL).toString() +
          `?ts=${Date.now()}`;

        const res = await fetch(jsonUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${res.url}`);
        const json = await res.json();

        const parsed: Fund[] = (json || []).map((r: any) => ({
          Ticker: r["Ticker"],
          "Fund Name": r["Fund Name"],
          "Closing Price": parseNum(r["Closing Price"]),
          "Average Yield to Maturity": parseNum(
            r["Average Yield to Maturity"]
          ),
          "Weighted Avg Coupon": parseNum(r["Weighted Avg Coupon"]),
          "Effective Duration": parseNum(r["Effective Duration"]),
          "Weighted Avg Maturity": parseNum(r["Weighted Avg Maturity"]),
          "Option Adjusted Spread": parseNum(r["Option Adjusted Spread"]),
          // Map Detail URL -> Detail so the "View" link renders
          Detail: r["Detail URL"] ?? r["Detail"],
        }));

        setFunds(parsed);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load funds.json");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* --------------------- Bounds & defaults --------------------- */
  const ytmVals = useMemo(
    () =>
      funds
        .map((f) => f["Average Yield to Maturity"])
        .filter((n): n is number => typeof n === "number"),
    [funds]
  );
  const durVals = useMemo(
    () =>
      funds
        .map((f) => f["Effective Duration"])
        .filter((n): n is number => typeof n === "number"),
    [funds]
  );
  const oasVals = useMemo(
    () =>
      funds
        .map((f) => f["Option Adjusted Spread"])
        .filter((n): n is number => typeof n === "number"),
    [funds]
  );

  const ytmMinBound = ytmVals.length
    ? Math.floor(Math.min(...ytmVals) * 4) / 4
    : 0; // round .25
  const ytmMaxBound = ytmVals.length
    ? Math.ceil(Math.max(...ytmVals) * 4) / 4
    : 10;
  const durMinBound = durVals.length ? Math.floor(Math.min(...durVals)) : 0;
  const durMaxBound = durVals.length ? Math.ceil(Math.max(...durVals)) : 30;
  const oasMinBound = oasVals.length
    ? Math.floor(Math.min(...oasVals) / 5) * 5
    : 0; // nearest 5
  const oasMaxBound = oasVals.length
    ? Math.ceil(Math.max(...oasVals) / 5) * 5
    : 500;

  // Set defaults once data is available
  useEffect(() => {
    if (!funds.length) return;
    if (ytmMin === undefined) setYtmMin(ytmMinBound);
    if (ytmMax === undefined) setYtmMax(ytmMaxBound);
    if (durMin === undefined) setDurMin(durMinBound);
    if (durMax === undefined) setDurMax(durMaxBound);
    if (oasMin === undefined) setOasMin(oasMinBound);
    if (oasMax === undefined) setOasMax(oasMaxBound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funds]);

  const hasBounds = ytmVals.length > 0; // to disable inputs during first load

  /* ----------------------- Filter + sort ----------------------- */
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
        ytmMin !== undefined
          ? (f["Average Yield to Maturity"] ?? -Infinity) >= ytmMin
          : true
      )
      .filter((f) =>
        ytmMax !== undefined
          ? (f["Average Yield to Maturity"] ?? Infinity) <= ytmMax
          : true
      )
      .filter((f) =>
        durMin !== undefined
          ? (f["Effective Duration"] ?? -Infinity) >= durMin
          : true
      )
      .filter((f) =>
        durMax !== undefined
          ? (f["Effective Duration"] ?? Infinity) <= durMax
          : true
      )
      .filter((f) =>
        oasMin !== undefined
          ? (f["Option Adjusted Spread"] ?? -Infinity) >= oasMin
          : true
      )
      .filter((f) =>
        oasMax !== undefined
          ? (f["Option Adjusted Spread"] ?? Infinity) <= oasMax
          : true
      );
  }, [funds, q, ytmMin, ytmMax, durMin, durMax, oasMin, oasMax]);

  const sortedFunds = useMemo(() => {
    const arr = [...filteredFunds];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = typeof av === "number" ? av : -Infinity;
      const bn = typeof bv === "number" ? bv : -Infinity;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [filteredFunds, sortKey, sortDir]);

  /* ----------------------- KPIs & charts ----------------------- */
  const avgYtm = useMemo(
    () =>
      filteredFunds.length
        ? filteredFunds.reduce(
            (s, f) => s + (f["Average Yield to Maturity"] ?? 0),
            0
          ) / filteredFunds.length
        : 0,
    [filteredFunds]
  );
  const avgDuration = useMemo(
    () =>
      filteredFunds.length
        ? filteredFunds.reduce(
            (s, f) => s + (f["Effective Duration"] ?? 0),
            0
          ) / filteredFunds.length
        : 0,
    [filteredFunds]
  );

  function makeBins(values: number[], step: number) {
    if (!values.length) return [] as { bucket: string; count: number }[];
    const min = Math.floor(Math.min(...values) / step) * step;
    const max = Math.ceil(Math.max(...values) / step) * step;
    const bins: { bucket: string; count: number }[] = [];
    for (let x = min; x <= max; x += step) {
      const next = x + step;
      bins.push({
        bucket: `${x.toFixed(1)}–${next.toFixed(1)}`,
        count: values.filter((v) => v >= x && v < next).length,
      });
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

  /* --------------------------- Actions ------------------------- */
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
    const blob = new Blob([header + "\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "funds_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setQ("");
    setYtmMin(ytmMinBound);
    setYtmMax(ytmMaxBound);
    setDurMin(durMinBound);
    setDurMax(durMaxBound);
    setOasMin(oasMinBound);
    setOasMax(oasMaxBound);
  }

  const ChartTabs = (
    <div className="inline-flex rounded-xl bg-slate-200 p-1 dark:bg-slate-700">
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
              (active
                ? "bg-white text-slate-900 dark:bg-slate-100 dark:text-slate-900 shadow"
                : "text-slate-700 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-white/10")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  /* ============================ UI ============================ */

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          fontFamily: "system-ui",
          color: "#b91c1c",
        }}
      >
        <h1>Load error</h1>
        <p>{error}</p>
        <p>Ensure <code>public/funds.json</code> exists in the deployed build.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white rounded-2xl shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-3xl font-bold">
                Fixed Income Dashboard
              </CardTitle>
              <p className="text-white/90 text-sm">
                Explore fixed income ETFs: search, filter, visualise and export
                the data scraped from iShares.
              </p>
            </div>
            <ThemeToggle />
          </CardHeader>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600/15 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-indigo-400 dark:text-indigo-300" />
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400 text-sm">
                  Total Funds
                </div>
                <div className="text-2xl font-semibold">
                  {filteredFunds.length}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-2xl bg-violet-600/15 flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-violet-400 dark:text-violet-300" />
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400 text-sm">
                  Avg. YTM
                </div>
                <div className="text-2xl font-semibold">{fmtPct(avgYtm)}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-2xl bg-fuchsia-600/15 flex items-center justify-center">
                <Clock className="h-6 w-6 text-fuchsia-400 dark:text-fuchsia-300" />
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400 text-sm">
                  Avg. Duration
                </div>
                <div className="text-2xl font-semibold">
                  {fmtYrs(avgDuration)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters */}
          <Card className="rounded-2xl shadow-sm bg-white dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Ticker or name"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              {/* YTM */}
              <div className="space-y-2">
                <Label>YTM Range (%)</Label>
                <Slider
                  value={[ytmMin ?? ytmMinBound, ytmMax ?? ytmMaxBound]}
                  min={ytmMinBound}
                  max={ytmMaxBound}
                  step={0.25}
                  onValueChange={([lo, hi]) => {
                    setYtmMin(lo);
                    setYtmMax(hi);
                  }}
                  disabled={!hasBounds}
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {(ytmMin ?? ytmMinBound).toFixed(2)}% –{" "}
                  {(ytmMax ?? ytmMaxBound).toFixed(2)}%
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <NumberStepper
                    label="YTM Min"
                    value={ytmMin}
                    setValue={setYtmMin}
                    step={0.25}
                    min={ytmMinBound}
                    max={ytmMaxBound}
                    suffix="%"
                    disabled={!hasBounds}
                  />
                  <NumberStepper
                    label="YTM Max"
                    value={ytmMax}
                    setValue={setYtmMax}
                    step={0.25}
                    min={ytmMinBound}
                    max={ytmMaxBound}
                    suffix="%"
                    disabled={!hasBounds}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Duration Range (yrs)</Label>
                <Slider
                  value={[durMin ?? durMinBound, durMax ?? durMaxBound]}
                  min={durMinBound}
                  max={durMaxBound}
                  step={0.5}
                  onValueChange={([lo, hi]) => {
                    setDurMin(lo);
                    setDurMax(hi);
                  }}
                  disabled={!hasBounds}
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {(durMin ?? durMinBound).toFixed(1)} –{" "}
                  {(durMax ?? durMaxBound).toFixed(1)} yrs
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <NumberStepper
                    label="Dur Min"
                    value={durMin}
                    setValue={setDurMin}
                    step={0.5}
                    min={durMinBound}
                    max={durMaxBound}
                    suffix="yrs"
                    disabled={!hasBounds}
                  />
                  <NumberStepper
                    label="Dur Max"
                    value={durMax}
                    setValue={setDurMax}
                    step={0.5}
                    min={durMinBound}
                    max={durMaxBound}
                    suffix="yrs"
                    disabled={!hasBounds}
                  />
                </div>
              </div>

              {/* OAS */}
              <div className="space-y-2">
                <Label>OAS Range (bps)</Label>
                <Slider
                  value={[oasMin ?? oasMinBound, oasMax ?? oasMaxBound]}
                  min={oasMinBound}
                  max={oasMaxBound}
                  step={5}
                  onValueChange={([lo, hi]) => {
                    setOasMin(lo);
                    setOasMax(hi);
                  }}
                  disabled={!hasBounds}
                />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {(oasMin ?? oasMinBound).toFixed(0)} –{" "}
                  {(oasMax ?? oasMaxBound).toFixed(0)} bps
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <NumberStepper
                    label="OAS Min"
                    value={oasMin}
                    setValue={setOasMin}
                    step={5}
                    min={oasMinBound}
                    max={oasMaxBound}
                    suffix="bps"
                    disabled={!hasBounds}
                  />
                  <NumberStepper
                    label="OAS Max"
                    value={oasMax}
                    setValue={setOasMax}
                    step={5}
                    min={oasMinBound}
                    max={oasMaxBound}
                    suffix="bps"
                    disabled={!hasBounds}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {filteredFunds.length} results
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                  <Button variant="secondary" onClick={exportCsv}>
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card className="rounded-2xl shadow-sm bg-white dark:bg-slate-800 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Analytics</CardTitle>
              {ChartTabs}
            </CardHeader>
            <CardContent className="h-[360px]">
              {tab === "scatter" && (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid stroke={gridColor} />
                    <XAxis
                      dataKey="x"
                      name="Duration"
                      unit=" yrs"
                      type="number"
                      tick={{ fontSize: 12, fill: axisColor }}
                      tickLine={false}
                      axisLine={{ stroke: axisColor }}
                    />
                    <YAxis
                      dataKey="y"
                      name="YTM"
                      unit="%"
                      type="number"
                      tick={{ fontSize: 12, fill: axisColor }}
                      tickLine={false}
                      axisLine={{ stroke: axisColor }}
                    />
                    <ZAxis dataKey="z" range={[60, 400]} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: isDark ? "#0f172a" : "#ffffff",
                        color: isDark ? "#e5e7eb" : "#0f172a",
                        border: "1px solid",
                        borderColor: isDark ? "#334155" : "#e5e7eb",
                      }}
                      formatter={(val: any, name: string) => {
                        if (name === "y") return [fmtPct(val), "YTM"];
                        if (name === "x") return [fmtYrs(val), "Duration"];
                        if (name === "z") return [fmtBps(val), "OAS"];
                        return [val, name];
                      }}
                      labelFormatter={(_, p: any) => p && p.payload?.ticker}
                    />
                    <Legend wrapperStyle={{ color: axisColor }} />
                    <Scatter
                      name="Funds"
                      data={filteredFunds
                        .filter(
                          (f) =>
                            f["Average Yield to Maturity"] !== undefined &&
                            f["Effective Duration"] !== undefined
                        )
                        .map((f) => ({
                          x: f["Effective Duration"]!,
                          y: f["Average Yield to Maturity"]!,
                          z: f["Option Adjusted Spread"] ?? 0,
                          ticker: f.Ticker,
                        }))}
                      fill={dotFill}
                      stroke={dotStroke}
                      opacity={0.9}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}

              {tab === "ytm" && (
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart
                    data={ytmBins}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid stroke={gridColor} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 12, fill: axisColor }}
                      axisLine={{ stroke: axisColor }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: axisColor }}
                      axisLine={{ stroke: axisColor }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: isDark ? "#0f172a" : "#ffffff",
                        color: isDark ? "#e5e7eb" : "#0f172a",
                        border: "1px solid",
                        borderColor: isDark ? "#334155" : "#e5e7eb",
                      }}
                    />
                    <Bar dataKey="count" fill={ytmBar} />
                  </RBarChart>
                </ResponsiveContainer>
              )}

              {tab === "duration" && (
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart
                    data={durBins}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid stroke={gridColor} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 12, fill: axisColor }}
                      axisLine={{ stroke: axisColor }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: axisColor }}
                      axisLine={{ stroke: axisColor }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: isDark ? "#0f172a" : "#ffffff",
                        color: isDark ? "#e5e7eb" : "#0f172a",
                        border: "1px solid",
                        borderColor: isDark ? "#334155" : "#e5e7eb",
                      }}
                    />
                    <Bar dataKey="count" fill={durBar} />
                  </RBarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="rounded-2xl shadow-sm bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Fund Details</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-300">
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
                        if (sortKey === key)
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        else {
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {sortedFunds.map((f) => (
                  <tr
                    key={f.Ticker}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap font-medium">
                      {f.Ticker}
                    </td>
                    <td className="py-2 pr-4">{f["Fund Name"]}</td>
                    <td className="py-2 pr-4">{fmtUsd(f["Closing Price"])}</td>
                    <td className="py-2 pr-4">
                      {fmtPct(f["Average Yield to Maturity"])}
                    </td>
                    <td className="py-2 pr-4">
                      {fmtPct(f["Weighted Avg Coupon"])}
                    </td>
                    <td className="py-2 pr-4">
                      {fmtYrs(f["Effective Duration"])}
                    </td>
                    <td className="py-2 pr-4">
                      {fmtYrs(f["Weighted Avg Maturity"])}
                    </td>
                    <td className="py-2 pr-4">
                      {fmtBps(f["Option Adjusted Spread"])}
                    </td>
                    <td className="py-2 pr-0">
                      {f.Detail ? (
                        <a
                          href={f.Detail}
                          className="text-indigo-600 dark:text-indigo-300 hover:underline"
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

        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pb-6">
          Data source: iShares (scraped). Visualization for internal analysis
          only.
        </div>
      </div>
    </div>
  );
};

export default App;
