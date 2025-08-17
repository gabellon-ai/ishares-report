import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'        // resolves App.tsx
import './index.css'

console.log('main.tsx booted')
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
