import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
import { BusinessProvider } from './contexts/BusinessContext'
import { LocationProvider } from './contexts/LocationContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <BrowserRouter>
      <AuthProvider>
        <BusinessProvider>
          <LocationProvider>
            <App />
          </LocationProvider>
        </BusinessProvider>
      </AuthProvider>
    </BrowserRouter>
  </GoogleOAuthProvider>
)
