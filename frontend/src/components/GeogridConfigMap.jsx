import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Carte de configuration de la grille (Étape 1 du wizard) : un marqueur central DÉPLAÇABLE (le centre de
// la grille) + les points d'aperçu (non interactifs) + un CONTOUR de cercle en mode 'circle' (circonscrit
// à la grille — même nombre de points qu'en carré, cf. GEOGRID_REFONTE_FR.md §6). À la différence de
// GeogridMap (heatmap lecture seule), on ne montre pas de rang — juste la géométrie, avant tout scan.
// onCenterChange(lat, lng) est appelé au relâchement du marqueur (dragend), pas pendant le glissement.
// fitToken : quand il change, la carte recadre (changements de taille/espacement/forme/recentrage) —
// PAS au glissement (sinon la carte sauterait sous les doigts de l'utilisateur).
export default function GeogridConfigMap({ center, points, shape = 'square', radiusMeters = 0, onCenterChange, fitToken = 0, className = '' }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const markerCtorRef = useRef(null)
  const centerMarkerRef = useRef(null)
  const pointMarkersRef = useRef([])
  const circleRef = useRef(null)
  const lastFitRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  // Initialisation unique
  useEffect(() => {
    let cancelled = false
    setOptions({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY, version: 'weekly', language: 'fr' })
    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([maps, marker]) => {
        if (cancelled || !divRef.current) return
        mapRef.current = new maps.Map(divRef.current, {
          center: center || { lat: 0, lng: 0 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        })
        markerCtorRef.current = marker.Marker
        setStatus('ready')
      })
      .catch(err => {
        console.error('[GeogridConfig] Échec chargement carte:', err)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  // Marqueur central déplaçable — position suit la prop `center`
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !markerCtorRef.current || !center) return
    const Marker = markerCtorRef.current
    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new Marker({
        position: center,
        map: mapRef.current,
        draggable: true,
        title: 'Centre de la grille — glissez pour déplacer',
        zIndex: 1000,
      })
      centerMarkerRef.current.addListener('dragend', e => onCenterChange?.(e.latLng.lat(), e.latLng.lng()))
    } else {
      centerMarkerRef.current.setPosition(center)
    }
  }, [status, center, onCenterChange])

  // Contour de cercle (mode 'circle')
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    const g = window.google
    if (shape === 'circle' && center && radiusMeters > 0) {
      if (!circleRef.current) {
        circleRef.current = new g.maps.Circle({
          map: mapRef.current, center, radius: radiusMeters,
          strokeColor: '#5B5B6B', strokeOpacity: 0.85, strokeWeight: 2,
          fillColor: '#7C5CFC', fillOpacity: 0.05, clickable: false, zIndex: 1,
        })
      } else {
        circleRef.current.setCenter(center)
        circleRef.current.setRadius(radiusMeters)
        circleRef.current.setMap(mapRef.current)
      }
    } else if (circleRef.current) {
      circleRef.current.setMap(null)
    }
  }, [status, shape, center, radiusMeters])

  // Points d'aperçu (foncés et bien visibles sur le fond clair Google Maps)
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !markerCtorRef.current) return
    const Marker = markerCtorRef.current
    const g = window.google

    pointMarkersRef.current.forEach(m => m.setMap(null))
    pointMarkersRef.current = []

    if (points && points.length) {
      points.forEach(pt => {
        const pos = { lat: Number(pt.lat), lng: Number(pt.lng) }
        if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return
        pointMarkersRef.current.push(new Marker({
          position: pos,
          map: mapRef.current,
          clickable: false,
          zIndex: 500,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#1F1F2B',
            fillOpacity: 0.92,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          },
        }))
      })
    }

    // Recadrage seulement sur changement explicite de fitToken (taille/espacement/forme/recentrage).
    if (lastFitRef.current !== fitToken && (points?.length || (shape === 'circle' && radiusMeters > 0))) {
      lastFitRef.current = fitToken
      const bounds = new g.maps.LatLngBounds()
      ;(points || []).forEach(pt => bounds.extend({ lat: Number(pt.lat), lng: Number(pt.lng) }))
      // En mode cercle, le contour déborde la grille → élargir les bornes pour l'inclure entièrement.
      if (shape === 'circle' && center && radiusMeters > 0) {
        const dLat = radiusMeters / 111320
        const dLng = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180))
        bounds.extend({ lat: center.lat + dLat, lng: center.lng + dLng })
        bounds.extend({ lat: center.lat - dLat, lng: center.lng - dLng })
      }
      mapRef.current.fitBounds(bounds, 48)
    }
  }, [points, status, fitToken, shape, radiusMeters, center])

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-border bg-bg-page ${className}`}>
      <div ref={divRef} className="w-full h-full" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-page text-sm text-text-secondary">
          {status === 'error' ? 'Impossible de charger la carte Google Maps.' : 'Chargement de la carte…'}
        </div>
      )}
    </div>
  )
}
