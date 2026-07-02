import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Carte de configuration de la grille (Étape 1 du wizard) : un marqueur central DÉPLAÇABLE (le centre de
// la grille) + les points d'aperçu (non interactifs, petits points accent). À la différence de GeogridMap
// (heatmap lecture seule), ici on ne montre pas de rang — juste la géométrie, avant tout scan.
// onCenterChange(lat, lng) est appelé au relâchement du marqueur (dragend), pas pendant le glissement.
// fitToken : quand il change, la carte recadre sur les points (utilisé aux changements de taille/espacement
// et au recentrage, PAS au glissement — sinon la carte sauterait sous les doigts de l'utilisateur).
export default function GeogridConfigMap({ center, points, onCenterChange, fitToken = 0 }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const markerCtorRef = useRef(null)
  const centerMarkerRef = useRef(null)
  const pointMarkersRef = useRef([])
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

  // Marqueur central déplaçable — créé une fois la carte prête, sa position suit la prop `center`.
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
      centerMarkerRef.current.addListener('dragend', e => {
        onCenterChange?.(e.latLng.lat(), e.latLng.lng())
      })
    } else {
      centerMarkerRef.current.setPosition(center)
    }
  }, [status, center, onCenterChange])

  // Points d'aperçu (petits points accent, non cliquables)
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !markerCtorRef.current) return
    const Marker = markerCtorRef.current
    const g = window.google

    pointMarkersRef.current.forEach(m => m.setMap(null))
    pointMarkersRef.current = []

    if (!points || !points.length) return
    points.forEach(pt => {
      const pos = { lat: Number(pt.lat), lng: Number(pt.lng) }
      if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return
      pointMarkersRef.current.push(new Marker({
        position: pos,
        map: mapRef.current,
        clickable: false,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#7C5CFC',
          fillOpacity: 0.55,
          strokeColor: '#fff',
          strokeWeight: 1,
        },
      }))
    })

    // Recadrage seulement sur changement explicite de fitToken (taille/espacement/recentrage), pas au drag.
    if (lastFitRef.current !== fitToken) {
      lastFitRef.current = fitToken
      const bounds = new g.maps.LatLngBounds()
      points.forEach(pt => bounds.extend({ lat: Number(pt.lat), lng: Number(pt.lng) }))
      mapRef.current.fitBounds(bounds, 60)
    }
  }, [points, status, fitToken])

  return (
    <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-border bg-bg-page">
      <div ref={divRef} className="w-full h-full" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-page text-sm text-text-secondary">
          {status === 'error' ? 'Impossible de charger la carte Google Maps.' : 'Chargement de la carte…'}
        </div>
      )}
    </div>
  )
}
