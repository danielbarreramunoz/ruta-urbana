import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Orden deliberado: Leaflet primero, nuestro tema después (así el tema gana).
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
