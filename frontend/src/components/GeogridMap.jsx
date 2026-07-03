import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { rankColor, rankLabel } from '../lib/geogrid'

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function infoContent(pt) {
  const head = pt.rank == null
    ? '<strong>Fiche non classée ici</strong>'
    : `<strong>Votre rang ici : #${pt.rank}</strong>`
  const comps = (pt.competitors || []).slice(0, 5).map(c => {
    const note = c.rating != null ? ` · ${c.rating}★` : ''
    return `<li style="margin:2px 0">#${c.rank ?? '—'} — ${esc(c.name || '—')}<span style="color:#9B9BA8">${note}</span></li>`
  }).join('')
  return `<div style="font-family:system-ui,sans-serif;font-size:12px;color:#1A1A23;min-width:190px;line-height:1.4">
    ${head}
    ${comps ? `<div style="margin-top:6px;color:#6B6B78">Concurrents à ce point :</div><ol style="margin:4px 0 0;padding-left:18px">${comps}</ol>` : ''}
  </div>`
}

// Carte Google Maps rendant une heatmap de positionnement : un marqueur circulaire coloré (couleur = bucket
// de rang) par point de grille, avec le rang au centre ; clic → InfoWindow des concurrents à ce point.
// Marqueurs legacy `Marker` (pas d'AdvancedMarkerElement, qui exigerait un mapId Cloud).
export default function GeogridMap({ center, points, heightClass = 'h-[460px]' }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const markerCtorRef = useRef(null)
  const infoRef = useRef(null)
  const markersRef = useRef([])
  const [status, setStatus] = useState('loading') // loading | ready | error

  // Initialisation unique de la carte
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
        infoRef.current = new maps.InfoWindow()
        markerCtorRef.current = marker.Marker
        setStatus('ready')
      })
      .catch(err => {
        console.error('[Geogrid] Échec chargement carte:', err)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  // (Re)dessine les marqueurs à chaque changement de points
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !markerCtorRef.current) return
    const Marker = markerCtorRef.current
    const g = window.google

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (!points || !points.length) return
    const bounds = new g.maps.LatLngBounds()

    points.forEach(pt => {
      const pos = { lat: Number(pt.lat), lng: Number(pt.lng) }
      if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return
      bounds.extend(pos)
      const marker = new Marker({
        position: pos,
        map: mapRef.current,
        title: pt.rank == null ? 'Non classé' : `Rang ${pt.rank}`,
        label: { text: rankLabel(pt.rank), color: '#fff', fontSize: '11px', fontWeight: '700' },
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: rankColor(pt.rank),
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1.5,
        },
      })
      marker.addListener('click', () => {
        infoRef.current.setContent(infoContent(pt))
        infoRef.current.open(mapRef.current, marker)
      })
      markersRef.current.push(marker)
    })

    mapRef.current.fitBounds(bounds, 48)
  }, [points, status])

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-border bg-bg-page`}>
      <div ref={divRef} className="w-full h-full" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-page text-sm text-text-secondary">
          {status === 'error'
            ? 'Impossible de charger la carte Google Maps.'
            : 'Chargement de la carte…'}
        </div>
      )}
    </div>
  )
}
