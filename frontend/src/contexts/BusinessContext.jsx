import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  // null = pas encore chargées pour la session en cours (distinct de [] = chargées, aucune entreprise) —
  // sert de sentinelle pour dériver isLoading sans dépendre du timing de l'effet (l'effet ne peut pas
  // mettre à jour un flag "isLoading" assez tôt pour le rendu qui suit immédiatement le login).
  const [businesses, setBusinesses]           = useState(null)
  const [activeBusiness, setActiveState]      = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { setBusinesses(null); setActiveState(null); return }

    api.get('/api/v1/businesses')
      .then(data => {
        setBusinesses(data)
        const savedId = localStorage.getItem('active_business_id')
        const saved   = data.find(b => b.id === savedId)
        setActiveState(saved || data[0] || null)
      })
      .catch(() => setBusinesses([]))
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
      businesses: businesses || [],
      activeBusiness,
      setActiveBusiness,
      isLoading: authLoading || (isAuthenticated && businesses === null),
      hasBusinesses: !!businesses && businesses.length > 0,
      refresh,
    }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  return useContext(BusinessContext)
}
