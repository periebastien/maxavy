import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [businesses, setBusinesses]           = useState([])
  const [activeBusiness, setActiveState]      = useState(null)
  const [isLoading, setIsLoading]             = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { setIsLoading(false); return }

    api.get('/api/v1/businesses')
      .then(data => {
        setBusinesses(data)
        const savedId = localStorage.getItem('active_business_id')
        const saved   = data.find(b => b.id === savedId)
        setActiveState(saved || data[0] || null)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, authLoading])

  function setActiveBusiness(business) {
    setActiveState(business)
    localStorage.setItem('active_business_id', business.id)
  }

  async function refresh() {
    const data = await api.get('/api/v1/businesses')
    setBusinesses(data)
    const savedId = localStorage.getItem('active_business_id')
    const saved   = data.find(b => b.id === savedId)
    setActiveState(saved || data[0] || null)
    return data
  }

  return (
    <BusinessContext.Provider value={{
      businesses,
      activeBusiness,
      setActiveBusiness,
      isLoading,
      hasBusinesses: businesses.length > 0,
      refresh,
    }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  return useContext(BusinessContext)
}
