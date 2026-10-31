import { createRoot } from 'react-dom/client'
import '@fontsource/baloo-2/500.css'
import '@fontsource/baloo-2/800.css'
import '@fontsource/cinzel/500.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import './index.css'
import './cafe.css'
import './gala.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
