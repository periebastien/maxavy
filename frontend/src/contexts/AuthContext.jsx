import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [token, setToken]         = useState(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) { setIsLoading(false); return }
    api.get('/api/v1/auth/me')
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email, password) {
    const data = await api.post('/api/v1/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  async function register(fields) {
    const data = await api.post('/api/v1/auth/register', fields)
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  async function loginWithGoogle(credential) {
    const data = await api.post('/api/v1/auth/google', { credential })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('active_business_id')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
