import { useEffect, useState } from 'react'

export default function App() {
  const [rows, setRows] = useState(null)  // null=loading
  const [error, setError] = useState('')

  // On Vercel, BASE_URL = '/' => this becomes '/funds.json'
  const jsonUrl = new URL('funds.json', import.meta.env.BASE_URL).toString() + `?ts=${Date.now()}`

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch(jsonUrl, { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${r.url}`)
        const data = await r.json()
        if (!Array.isArray(data)) throw new Error('Expected an array in funds.json')
        setRows(data)
      } catch (e) { setError(String(e)) }
    })()
  }, [jsonUrl])

  if (error) return <ErrorBox msg={error} />
  if (rows === null) return <Box>Loading…</Box>
  if (rows.length === 0) return <Box>No rows found.</Box>

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ marginBottom: 12 }}>iShares Fixed Income — {rows.length} funds</h1>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              {['Ticker','Fund Name','Closing Price','Average Yield to Maturity','Weighted Avg Coupon','Effective Duration','Weighted Avg Maturity','Option Adjusted Spread'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #ddd' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={(r['Ticker'] ?? 'row') + '-' + i} style={{ background: i % 2 ? '#fafafa' : 'white' }}>
                <td style={{ padding: '8px 12px' }}>{r['Ticker'] ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>{r['Fund Name'] ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>{fmt(r['Closing Price'])}</td>
                <td style={{ padding: '8px 12px' }}>{fmt(r['Average Yield to Maturity'])}</td>
                <td style={{ padding: '8px 12px' }}>{fmt(r['Weighted Avg Coupon'])}</td>
                <td style={{ padding: '8px 12px' }}>{fmt(r['Effective Duration'])}</td>
                <td style={{ padding: '8px 12px' }}>{fmt(r['Weighted Avg Maturity'])}</td>
                <td style={{ padding: '8px 12px' }}>{fmt(r['Option Adjusted Spread'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2)
  return String(v)
}
function Box({ children }) { return <div style={{ padding: 16, fontFamily: 'system-ui' }}>{children}</div> }
function ErrorBox({ msg }) { return <div style={{ padding: 16, color: '#b91c1c', fontFamily: 'system-ui' }}>
  <h1>Load error</h1><p>{msg}</p><p>Check that <code>public/funds.json</code> exists in the repo and is valid JSON.</p></div> }
