import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Design-System „Übungswiese“: zuerst Variablen und Schriften, dann die Bausteine, dann die App-eigenen Regeln,
// zuletzt die beiden Looks: Pixel (Schüler:innen, .wiese) und Ruhig (Lehrkraft, .lehrkraft).
import './design/tokens.css'
import './design/bundle.css'
import './design/icons.css'
import './design/wiese.css'
import './index.css'
import './design/pixel.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
