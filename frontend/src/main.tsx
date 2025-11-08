import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Usa la ruta local al componente de shadcn/ui
import { Toaster } from './components/ui/sonner' 
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster richColors />
  </React.StrictMode>,
)