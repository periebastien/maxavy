import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useBusiness } from './BusinessContext'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const { activeBusiness } = useBusiness()
  const [locations, setLocations]        = useState([])
  const [activeLocation, setActiveState] = useState(null)
  const [isLoading, setIsLoading]        = useState(false)

  // Choisit la localisation active : celle mémorisée pour ce business (localStorage), sinon la première.
  const pickActive = useCallback((businessId, list) => {
    if (!businessId || list.length === 0) return null
    const savedId = localStorage.getItem(`active_location_id:${businessId}`)
    return list.find(l => l.id === savedId) || list[0]
  }, [])

  const load = useCallback(async (businessId) => {
    if (!businessId) { setLocations([]); setActiveState(null); return [] }
    setIsLoading(true)
    try {
      const data = await api.get(`/api/v1/locations?business_id=${businessId}`)
      setLocations(data)
      setActiveState(pickActive(businessId, data))
      return data
    } catch {
      setLocations([]); setActiveState(null)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [pickActive])

  useEffect(() => { load(activeBusiness?.id) }, [activeBusiness?.id, load])

  const refresh = useCallback(() => load(activeBusiness?.id), [activeBusiness?.id, load])

  function setActiveLocation(loc) {
    setActiveState(loc)
    if (loc && activeBusiness?.id) {
      localStorage.setItem(`active_location_id:${activeBusiness.id}`, loc.id)
    }
  }

  return (
    <LocationContext.Provider value={{
      locations,
      activeLocation,
      setActiveLocation,
      hasLocations: locations.length > 0,
      isLoading,
      refresh,
    }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocations() {
  return useContext(LocationContext)
}
