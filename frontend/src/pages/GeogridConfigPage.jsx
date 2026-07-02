import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Loader2, Lock, LayoutGrid, Search, CalendarClock, Swords, Square, Circle, RotateCcw } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import StepIndicator from '../components/common/StepIndicator'
import GeogridConfigMap from '../components/GeogridConfigMap'
import Button from '../components/common/Button'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const STEPS = [
  { id: 1, label: 'Grille',      icon: LayoutGrid },
  { id: 2, label: 'Mots-clés',   icon: Search },
  { id: 3, label: 'Planning',    icon: CalendarClock },
  { id: 4, label: 'Concurrents', icon: Swords },
]

const COST_PER_POINT = 0.0012 // $ — DataForSEO queue Priority (voir GEOGRID_DESIGN_FR.md §9)
const SPACING_OPTIONS = [250, 500, 750, 1000, 1500, 2000]

// Tailles impaires jusqu'au plafond du plan (grille N×N, N impair pour qu'un point tombe pile au centre).
function gridSizeOptions(cap) {
  const out = []
  for (let n = 3; n <= (cap || 7); n += 2) out.push(n)
  return out
}

function fmtNum(n) {
  const r = Math.round(n * 100) / 100
  return (Number.isInteger(r) ? r : r.toFixed(r < 1 ? 2 : 1)).toString().replace('.', ',')
}

export default function GeogridConfigPage() {
  const navigate = useNavigate()
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)

  // Étape 1 — grille
  const [shape, setShape] = useState('square')
  const [gridSize, setGridSize] = useState(7)
  const [spacing, setSpacing] = useState(500)
  const [center, setCenter] = useState(null)     // { lat, lng } — toujours concret pour la carte/l'aperçu
  const [centerCustom, setCenterCustom] = useState(false) // true = centre déplacé (stocké), false = suit la fiche
  const [preview, setPreview] = useState(null)   // { points, grid_size, ... }
  const [previewing, setPreviewing] = useState(false)
  const [fitToken, setFitToken] = useState(0)
  const [saving, setSaving] = useState(false)

  const bid = activeBusiness?.id
  const locId = activeLocation?.id
  const fiche = activeLocation && activeLocation.lat != null && activeLocation.lng != null
    ? { lat: Number(activeLocation.lat), lng: Number(activeLocation.lng) }
    : null

  // Charge quota + config existante
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError('')
    Promise.all([
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/config?business_id=${bid}&location_id=${locId}`),
    ])
      .then(([q, cfg]) => {
        if (cancelled) return
        setQuota(q)
        if (q.enabled) {
          setShape(cfg.shape || 'square')
          setGridSize(cfg.grid_size || 7)
          setSpacing(cfg.grid_spacing_m || 500)
          const custom = cfg.center_lat != null && cfg.center_lng != null
          setCenterCustom(custom)
          setCenter(custom ? { lat: Number(cfg.center_lat), lng: Number(cfg.center_lng) } : fiche)
          setFitToken(t => t + 1)
        }
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Aperçu de la grille (débounce) à chaque changement de forme/taille/espacement/centre
  useEffect(() => {
    if (!bid || !locId || !center || !quota?.enabled) return
    let cancelled = false
    setPreviewing(true)
    const t = setTimeout(() => {
      const qs = new URLSearchParams({
        business_id: bid, location_id: locId,
        grid_size: gridSize, grid_spacing_m: spacing, shape,
        center_lat: center.lat, center_lng: center.lng,
      })
      api.get(`/api/v1/rank-tracking/grid-preview?${qs}`)
        .then(p => { if (!cancelled) setPreview(p) })
        .catch(e => { if (!cancelled) setError(e.message) })
        .finally(() => { if (!cancelled) setPreviewing(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [bid, locId, shape, gridSize, spacing, center, quota])

  const onCenterChange = useCallback((lat, lng) => {
    setCenter({ lat, lng })
    setCenterCustom(true)
  }, [])

  function recenter() {
    if (!fiche) return
    setCenter(fiche)
    setCenterCustom(false)
    setFitToken(t => t + 1)
  }
  function changeSize(n) { setGridSize(n); setFitToken(t => t + 1) }
  function changeSpacing(m) { setSpacing(m); setFitToken(t => t + 1) }

  async function saveGridAndNext() {
    setSaving(true); setError('')
    try {
      await api.put(`/api/v1/rank-tracking/config?business_id=${bid}&location_id=${locId}`, {
        shape, grid_size: gridSize, grid_spacing_m: spacing,
        center_lat: centerCustom ? center.lat : null,
        center_lng: centerCustom ? center.lng : null,
      })
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── États de garde ──
  if (!activeBusiness || !activeLocation) {
    return (
      <AppLayout title="Positionnement — Configuration">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <MapPin size={15} /> Sélectionnez une localisation pour la configurer.
        </div>
      </AppLayout>
    )
  }
  if (loading) {
    return (
      <AppLayout title="Positionnement — Configuration">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
      </AppLayout>
    )
  }
  if (quota && !quota.enabled) {
    return (
      <AppLayout title="Positionnement — Configuration">
        <div className="max-w-md mx-auto text-center bg-white border border-border rounded-2xl p-10 mt-8">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <Lock size={22} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Suivi de positionnement</h2>
          <p className="text-sm text-text-secondary mt-2">
            Mesurez votre classement sur Google Maps partout autour de votre établissement.
            Cette fonctionnalité n'est pas incluse dans votre plan actuel.
          </p>
          <button onClick={() => navigate('/pricing')}
            className="mt-5 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 h-9 rounded-lg hover:bg-violet-700 transition-colors">
            Voir les plans
          </button>
        </div>
      </AppLayout>
    )
  }

  const allowedShapes = quota?.allowed_shapes || ['square']
  const sizeOptions = gridSizeOptions(quota?.max_grid_size || 7)
  const pointCount = preview?.points?.length ?? 0
  const coverageKm = ((gridSize - 1) * spacing) / 1000
  const cost = pointCount * COST_PER_POINT

  return (
    <AppLayout title="Positionnement — Configuration">
      <div className="max-w-5xl">
        <div className="mb-8"><StepIndicator steps={STEPS} current={step} onStepClick={setStep} /></div>

        {error && (
          <div className="mb-4 text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* ── Étape 1 — Grille ── */}
        {step === 1 && (
          <div className="space-y-5">
            {!fiche && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                Cette localisation n'a pas de coordonnées GPS — impossible de centrer la grille.
              </div>
            )}

            <div className="grid lg:grid-cols-[320px_1fr] gap-5">
              {/* Contrôles */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Forme de la grille</label>
                  <div className="flex gap-2">
                    <ShapeButton active={shape === 'square'} onClick={() => setShape('square')} icon={<Square size={15} />} label="Carré" />
                    {allowedShapes.includes('circle') && (
                      <ShapeButton active={shape === 'circle'} onClick={() => setShape('circle')} icon={<Circle size={15} />} label="Cercle" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Densité de la grille</label>
                  <select value={gridSize} onChange={e => changeSize(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                    {sizeOptions.map(n => <option key={n} value={n}>{n} × {n}</option>)}
                  </select>
                  {quota?.max_grid_size && gridSize >= quota.max_grid_size && (
                    <p className="text-xs text-text-tertiary mt-1">Densité maximale de votre plan.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Espacement entre points</label>
                  <select value={spacing} onChange={e => changeSpacing(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                    {SPACING_OPTIONS.map(m => <option key={m} value={m}>{m < 1000 ? `${m} m` : `${fmtNum(m / 1000)} km`}</option>)}
                  </select>
                </div>

                <button onClick={recenter} disabled={!fiche || !centerCustom}
                  className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <RotateCcw size={14} /> Recentrer sur la fiche
                </button>

                {/* Compteur live */}
                <div className="bg-accent-light rounded-xl p-4 text-sm">
                  <div className="flex items-center gap-2 text-accent font-semibold">
                    {previewing ? <Loader2 size={14} className="animate-spin" /> : <LayoutGrid size={14} />}
                    {pointCount} point{pointCount > 1 ? 's' : ''}
                  </div>
                  <div className="text-text-secondary mt-1.5 space-y-0.5 text-xs">
                    <div>Couverture ~{fmtNum(coverageKm)} km de large</div>
                    <div>Coût estimé ~{fmtNum(cost)} $ par rapport</div>
                  </div>
                </div>
              </div>

              {/* Carte */}
              {center ? (
                <GeogridConfigMap
                  center={center}
                  points={preview?.points || []}
                  onCenterChange={onCenterChange}
                  fitToken={fitToken}
                />
              ) : (
                <div className="h-[420px] rounded-2xl border border-border bg-bg-page flex items-center justify-center text-sm text-text-tertiary">
                  Pas de coordonnées pour afficher la carte.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <p className="text-xs text-text-tertiary">Glissez le marqueur central sur la carte pour déplacer la zone analysée.</p>
              <Button onClick={saveGridAndNext} disabled={!fiche || saving || !pointCount}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Enregistrer et continuer
              </Button>
            </div>
          </div>
        )}

        {/* ── Étapes 2-4 — construites dans les sous-sessions suivantes ── */}
        {step > 1 && (
          <StepPlaceholder step={step} onBack={() => setStep(step - 1)} />
        )}
      </div>
    </AppLayout>
  )
}

function ShapeButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg border text-sm font-medium transition-colors
        ${active ? 'border-accent bg-accent-light text-accent' : 'border-border bg-white text-text-secondary hover:bg-gray-50'}`}>
      {icon} {label}
    </button>
  )
}

function StepPlaceholder({ step, onBack }) {
  const labels = { 2: 'Mots-clés', 3: 'Planning', 4: 'Concurrents' }
  const sessions = { 2: 'G8.2', 3: 'G8.2', 4: 'G8.3' }
  return (
    <div className="text-center bg-white border border-dashed border-border rounded-2xl p-12">
      <h3 className="text-sm font-semibold text-text-primary">Étape « {labels[step]} »</h3>
      <p className="text-sm text-text-secondary mt-1.5 max-w-sm mx-auto">
        Cette étape sera construite dans la session {sessions[step]}. L'Étape 1 (Grille) est déjà opérationnelle
        et enregistre bien la configuration.
      </p>
      <button onClick={onBack} className="mt-5 text-sm text-accent hover:underline">← Revenir à l'étape précédente</button>
    </div>
  )
}
