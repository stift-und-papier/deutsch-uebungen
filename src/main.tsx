import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Design-System „Übungswiese“: zuerst Variablen und Schriften, dann die Bausteine, dann die App-eigenen Regeln.
import './design/tokens.css'
import './design/bundle.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
