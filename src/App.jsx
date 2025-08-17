// src/App.jsx (data loader idea)
import { useEffect, useState } from "react";

export default function App() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const jsonUrl = new URL("funds.json", import.meta.env.BASE_URL).toString() + "?ts=" + Date.now();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(jsonUrl, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error("Expected array");
        setRows(data);
      } catch (e) { setError(String(e)); }
    })();
  }, [jsonUrl]);

  if (error) return <div style={{padding:16}}>Load error: {error}</div>;
  if (rows === null) return <div style={{padding:16}}>Loading…</div>;
  if (rows.length === 0) return <div style={{padding:16}}>No rows</div>;

  return <div style={{padding:16}}>iShares Fixed Income — {rows.length} rows</div>;
}
