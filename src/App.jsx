import { useEffect, useState } from "react";

export default function App() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    // cache-bust to avoid stale CDN/browser cache
    fetch(`/funds.json?ts=${Date.now()}`)
      .then(r => r.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  // ...render rows...
}
