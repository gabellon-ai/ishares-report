// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'          // resolves App.tsx
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing <div id="root"></div> in index.html')

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
