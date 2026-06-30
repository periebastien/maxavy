import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

export default function PlaceSearch({
  onSelect,
  country     = '',
  autoFocus   = false,
  placeholder = 'Recherchez votre établissement…',
}) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const [mapsStatus, setMapsStatus] = useState('loading')
  const wrapperRef                  = useRef(null)
  const svcRef                      = useRef(null)
  const statusOKRef                 = useRef(null)
  const justSelectedRef             = useRef(false)

  useEffect(() => {
    setOptions({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY, version: 'weekly', language: 'fr' })
    importLibrary('places').then(places => {
      svcRef.current      = new places.AutocompleteService()
      statusOKRef.current = places.PlacesServiceStatus.OK
      setMapsStatus('ready')
    }).catch(err => {
      console.error('[Places] Échec chargement:', err)
      setMapsStatus('error')
    })
  }, [])

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return }
    if (!query || query.trim().length < 3) { setResults([]); setOpen(false); return }
    const timer = setTimeout(() => {
      if (!svcRef.current) return
      setLoading(true)
      svcRef.current.getPlacePredictions(
        { input: query, types: ['establishment'], language: 'fr', ...(country ? { componentRestrictions: { country: country.toLowerCase() } } : {}) },
        (predictions, status) => {
          setLoading(false)
          if (status === statusOKRef.current && predictions) {
            setResults(predictions.slice(0, 6).map(p => ({
              place_id: p.place_id,
              name:     p.structured_formatting.main_text,
              address:  p.structured_formatting.secondary_text || p.description,
            })))
            setOpen(true)
          } else {
            setResults([])
            setOpen(false)
          }
        }
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [query, country])

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(place) {
    justSelectedRef.current = true
    setResults([])
    setOpen(false)
    setQuery(place.name)
    onSelect(place)
  }

  return (
    <div ref={wrapperRef} className="relative">
      {mapsStatus === 'loading' && (
        <p className="text-xs text-text-tertiary mb-2">Chargement de Google Maps…</p>
      )}
      {mapsStatus === 'error' && (
        <p className="text-xs text-danger mb-2">Google Maps API indisponible.</p>
      )}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={mapsStatus !== 'ready'}
          autoFocus={autoFocus}
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-border text-sm text-text-primary bg-white
            placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          {results.map(place => (
            <button
              key={place.place_id}
              type="button"
              onClick={() => select(place)}
              className="w-full text-left px-4 py-3 hover:bg-bg-page transition-colors border-b border-border last:border-0"
            >
              <p className="text-sm font-medium text-text-primary">{place.name}</p>
              <p className="text-xs text-text-secondary mt-0.5 truncate">{place.address}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
