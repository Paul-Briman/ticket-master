import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { AdminStoreProvider } from './lib/adminStore.jsx'
import './index.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const tree = (
  <BrowserRouter>
    <AuthProvider>
      <AdminStoreProvider>
        <App />
      </AdminStoreProvider>
    </AuthProvider>
  </BrowserRouter>
)

const root = googleClientId ? (
  <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
) : (
  tree
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{root}</React.StrictMode>,
)
