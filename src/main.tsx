import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { markUpdateReady } from './lib/pwa'
import './styles.css'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    markUpdateReady(() => void updateSW(true))
  },
})

createRoot(document.getElementById('root')!).render(<App />)
