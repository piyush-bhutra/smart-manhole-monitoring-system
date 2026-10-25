import { createRoot } from 'react-dom/client'
import App from './App'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import './styles/pulse.css'
import './styles/incidents.css'
import './styles/refinement.css'

createRoot(document.getElementById('root')!).render(<App />)
