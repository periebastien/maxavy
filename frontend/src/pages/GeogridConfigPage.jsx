import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Loader2, Lock, LayoutGrid, Search, CalendarClock, Swords, Square, Circle, RotateCcw,
  Trash2, Plus, Clock, Globe, CheckCircle2, ArrowRight,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import StepIndicator from '../components/common/StepIndicator'
import GeogridConfigMap from '../components/GeogridConfigMap'
import Button from '../components/common/Button'
import Select from '../components/common/Select'
import PlaceSearch from '../components/common/PlaceSearch'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const STEPS = [
  { id: 1, label: 'Grille',      icon: LayoutGrid },
  { id: 2, label: 'Mots-clés',   icon: Search },
  { id: 3, label: 'Planning',    icon: CalendarClock },
  { id: 4, label: 'Concurrents', icon: Swords },
]

const SPACING_OPTIONS = [250, 500, 750, 1000, 1500, 2000]

const FREQUENCY_LABELS = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel' }
const FREQUENCY_ORDER = ['daily', 'weekly', 'monthly']
// Convention backend (schedule.utils.js) : 0 = dimanche ... 6 = samedi (JS Date.getDay()).
const DAYS_OF_WEEK = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const TIMEZONES = [
  { value: 'Europe/Paris',      label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/Brussels',   label: 'Europe/Brussels (UTC+1/+2)' },
  { value: 'Europe/Zurich',     label: 'Europe/Zurich (UTC+1/+2)' },
  { value: 'Europe/Luxembourg', label: 'Europe/Luxembourg (UTC+1/+2)' },
  { value: 'America/Montreal',  label: 'America/Montréal (UTC-5/-4)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (UTC+1)' },
  { value: 'Africa/Tunis',      label: 'Africa/Tunis (UTC+1)' },
  { value: 'Africa/Dakar',      label: 'Africa/Dakar (UTC+0)' },
]

function fmtDateTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

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

// Distance approximative (m) entre le centre et un point, pour dimensionner le contour de cercle et la
// couverture d'après les points réels du disque (dont le rayon dépend de la disposition, pas d'une formule carrée).
function pointDistM(center, p) {
  const dLat = (Number(p.lat) - center.lat) * 111320
  const dLng = (Number(p.lng) - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
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

  // Étape 2 — mots-clés
  const [keywords, setKeywords] = useState([])
  const [newKeyword, setNewKeyword] = useState('')

  // Étape 3 — planning
  const [frequency, setFrequency] = useState('weekly')
  const [runHour, setRunHour] = useState(4)
  const [runDayOfWeek, setRunDayOfWeek] = useState(1)
  const [runDayOfMonth, setRunDayOfMonth] = useState(1)
  const [timezone, setTimezone] = useState('Europe/Paris')
  const [nextRunAt, setNextRunAt] = useState(null)
  const [savingPlanning, setSavingPlanning] = useState(false)

  // Étape 4 — concurrents
  const [configId, setConfigId] = useState(null)
  const [competitors, setCompetitors] = useState([])
  const [detectedList, setDetectedList] = useState([])
  const [loadingDetected, setLoadingDetected] = useState(false)
  const [detectedLoaded, setDetectedLoaded] = useState(false)

  // Étape 5 — récap
  const [runLaunched, setRunLaunched] = useState(null)
  const [launchingReport, setLaunchingReport] = useState(false)

  const bid = activeBusiness?.id
  const locId = activeLocation?.id
  const fiche = activeLocation && activeLocation.lat != null && activeLocation.lng != null
    ? { lat: Number(activeLocation.lat), lng: Number(activeLocation.lng) }
    : null

  // Charge quota + config + mots-clés existants
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError('')
    Promise.all([
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/config?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/keywords?business_id=${bid}&location_id=${locId}`),
    ])
      .then(async ([q, cfg, kws]) => {
        if (cancelled) return
        setQuota(q)
        setKeywords(kws)
        if (q.enabled) {
          setShape(cfg.shape || 'square')
          setGridSize(cfg.grid_size || 7)
          setSpacing(cfg.grid_spacing_m || 500)
          const custom = cfg.center_lat != null && cfg.center_lng != null
          setCenterCustom(custom)
          setCenter(custom ? { lat: Number(cfg.center_lat), lng: Number(cfg.center_lng) } : fiche)
          setFitToken(t => t + 1)

          setFrequency(cfg.frequency || 'weekly')
          setRunHour(Number.isInteger(cfg.run_hour) ? cfg.run_hour : 4)
          setRunDayOfWeek(Number.isInteger(cfg.run_day_of_week) ? cfg.run_day_of_week : 1)
          setRunDayOfMonth(Number.isInteger(cfg.run_day_of_month) ? cfg.run_day_of_month : 1)
          setTimezone(cfg.timezone || activeBusiness?.timezone || 'Europe/Paris')
          setNextRunAt(cfg.next_run_at || null)

          setConfigId(cfg.id)
          const comps = await api.get(`/api/v1/rank-tracking/competitors?business_id=${bid}&config_id=${cfg.id}`)
          if (cancelled) return
          setCompetitors(comps)

          // Localisation déjà configurée (≥1 mot-clé) : on saute directement au récap, avec accès libre
          // à toutes les étapes pour modifier — plus naturel qu'un retour au wizard linéaire à chaque fois.
          if (kws.length > 0) setStep(5)
        }
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Concurrents détectés (chargement paresseux, seulement à la visite de l'étape 4 — requête plus lourde,
  // pas nécessaire tant que l'utilisateur ne l'a pas ouverte).
  useEffect(() => {
    if (step !== 4 || !configId || detectedLoaded) return
    let cancelled = false
    setLoadingDetected(true)
    api.get(`/api/v1/rank-tracking/competitors/detected?business_id=${bid}&config_id=${configId}`)
      .then(list => { if (!cancelled) { setDetectedList(list); setDetectedLoaded(true) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingDetected(false) })
    return () => { cancelled = true }
  }, [step, configId, bid, detectedLoaded])

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

  async function addKeyword(e) {
    e.preventDefault()
    const kw = newKeyword.trim()
    if (!kw) return
    setError('')
    try {
      const created = await api.post(`/api/v1/rank-tracking/keywords?business_id=${bid}`, { location_id: locId, keyword: kw })
      setKeywords(k => [...k, created])
      setNewKeyword('')
      setQuota(q => (q ? { ...q, used: (q.used || 0) + 1 } : q))
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeKeyword(id) {
    if (!window.confirm('Supprimer ce mot-clé et tout son historique de scans ?')) return
    setError('')
    try {
      await api.delete(`/api/v1/rank-tracking/keywords/${id}?business_id=${bid}`)
      setKeywords(k => k.filter(kw => kw.id !== id))
      setQuota(q => (q ? { ...q, used: Math.max(0, (q.used || 0) - 1) } : q))
    } catch (e) {
      setError(e.message)
    }
  }

  async function savePlanningAndNext() {
    setSavingPlanning(true); setError('')
    try {
      const updated = await api.put(`/api/v1/rank-tracking/config?business_id=${bid}&location_id=${locId}`, {
        frequency, run_hour: runHour,
        run_day_of_week: frequency === 'weekly' ? runDayOfWeek : null,
        run_day_of_month: frequency === 'monthly' ? runDayOfMonth : null,
        timezone,
      })
      setNextRunAt(updated.next_run_at)
      setStep(4)
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingPlanning(false)
    }
  }

  async function addCompetitor(place_id, name) {
    setError('')
    try {
      const created = await api.post(`/api/v1/rank-tracking/competitors?business_id=${bid}`, { config_id: configId, place_id, name })
      setCompetitors(c => [...c, created])
      setDetectedList(d => d.filter(x => x.place_id !== place_id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeCompetitor(id) {
    setError('')
    try {
      await api.delete(`/api/v1/rank-tracking/competitors/${id}?business_id=${bid}`)
      setCompetitors(c => c.filter(x => x.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function launchFirstReport() {
    setLaunchingReport(true); setError('')
    try {
      const run = await api.post(`/api/v1/rank-tracking/runs?business_id=${bid}`, { location_id: locId })
      setRunLaunched(run)
    } catch (e) {
      setError(e.message)
    } finally {
      setLaunchingReport(false)
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
  const allowedFrequencies = quota?.allowed_frequencies || ['weekly']
  const atMaxKeywords = quota?.max_keywords != null && keywords.length >= quota.max_keywords
  const atMaxCompetitors = quota?.max_competitors != null && competitors.length >= quota.max_competitors
  const previewPoints = preview?.points || []
  const pointCount = previewPoints.length
  // Rayon du disque réel = distance du point le plus éloigné du centre. Sert au contour de cercle
  // (mode 'circle', + petite marge) et à la couverture (diamètre du disque).
  const maxRadiusM = shape === 'circle' && center && previewPoints.length
    ? Math.max(...previewPoints.map(p => pointDistM(center, p)))
    : 0
  const circleRadiusM = maxRadiusM ? Math.round(maxRadiusM * 1.06) : 0
  const coverageKm = maxRadiusM ? (2 * maxRadiusM) / 1000 : ((gridSize - 1) * spacing) / 1000

  return (
    <AppLayout title="Positionnement — Configuration">
      <div className="w-full">
        <div className="mb-8"><StepIndicator steps={STEPS} current={step} onStepClick={setStep} /></div>

        {error && (
          <div className="mb-4 text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* ── Étape 1 — Grille ── */}
        {step === 1 && (
          <div className="space-y-4">
            {!fiche && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                Cette localisation n'a pas de coordonnées GPS — impossible de centrer la grille.
              </div>
            )}

            {/* Carte pleine largeur */}
            {center ? (
              <GeogridConfigMap
                center={center}
                points={previewPoints}
                shape={shape}
                radiusMeters={circleRadiusM}
                onCenterChange={onCenterChange}
                fitToken={fitToken}
                className="h-[560px]"
              />
            ) : (
              <div className="h-[560px] rounded-2xl border border-border bg-bg-page flex items-center justify-center text-sm text-text-tertiary">
                Pas de coordonnées pour afficher la carte.
              </div>
            )}
            <p className="text-xs text-text-tertiary">Glissez le marqueur central sur la carte pour déplacer la zone analysée.</p>

            {/* Configuration sous la carte */}
            <div className="bg-white border border-border rounded-2xl p-4 grid sm:grid-cols-3 gap-4">
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
            </div>

            {/* Recentrer · stats · bouton */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button onClick={recenter} disabled={!fiche || !centerCustom}
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <RotateCcw size={14} /> Recentrer sur la fiche
              </button>

              <div className="flex items-center gap-4">
                <span className="text-sm text-text-secondary flex items-center gap-2">
                  {previewing && <Loader2 size={14} className="animate-spin text-accent" />}
                  <span><b className="text-text-primary">{pointCount} point{pointCount > 1 ? 's' : ''}</b> · couverture ~{fmtNum(coverageKm)} km</span>
                </span>
                <Button onClick={saveGridAndNext} disabled={!fiche || saving || !pointCount}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  Enregistrer et continuer
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 2 — Mots-clés ── */}
        {step === 2 && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
              {keywords.length > 0 ? (
                <ul className="divide-y divide-border">
                  {keywords.map(k => (
                    <li key={k.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-text-primary">{k.keyword}</span>
                      <button onClick={() => removeKeyword(k.id)}
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors"
                        title="Supprimer ce mot-clé">
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-tertiary">Aucun mot-clé pour l'instant — ajoutez-en au moins un pour continuer.</p>
              )}

              <form onSubmit={addKeyword} className="flex items-center gap-2 pt-1 border-t border-border">
                <input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  placeholder="Ajouter un mot-clé (ex : plombier Lyon)"
                  disabled={atMaxKeywords}
                  className="flex-1 h-9 px-3 rounded-lg border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:bg-gray-50"
                />
                <button type="submit" disabled={atMaxKeywords || !newKeyword.trim()}
                  className="inline-flex items-center gap-1.5 bg-white border border-border text-text-primary text-sm font-medium px-3 h-9 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus size={15} /> Ajouter
                </button>
              </form>

              {quota?.max_keywords != null && (
                <p className="text-xs text-text-tertiary">
                  {keywords.length} / {quota.max_keywords} mots-clés utilisés
                  {atMaxKeywords && ' — limite de votre plan atteinte'}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <button onClick={() => setStep(1)} className="text-sm text-text-secondary hover:text-accent transition-colors">← Retour</button>
              <Button onClick={() => setStep(3)} disabled={!keywords.length}>Continuer</Button>
            </div>
          </div>
        )}

        {/* ── Étape 3 — Planning ── */}
        {step === 3 && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-border rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Fréquence</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                  {FREQUENCY_ORDER.filter(f => allowedFrequencies.includes(f)).map(f => (
                    <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <Clock size={13} /> Heure de lancement
                </label>
                <select value={runHour} onChange={e => setRunHour(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Jour de la semaine</label>
                  <select value={runDayOfWeek} onChange={e => setRunDayOfWeek(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                    {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}

              {frequency === 'monthly' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Jour du mois</label>
                  <select value={runDayOfMonth} onChange={e => setRunDayOfMonth(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <p className="text-xs text-text-tertiary mt-1">Si le mois est plus court, le dernier jour du mois sera utilisé.</p>
                </div>
              )}

              <div className="sm:col-span-2">
                <Select label="Fuseau horaire" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </Select>
              </div>
            </div>

            {nextRunAt && (
              <p className="text-xs text-text-secondary flex items-center gap-1.5 px-1">
                <Globe size={13} /> Prochain rapport planifié le {fmtDateTime(nextRunAt)}
              </p>
            )}

            <div className="flex justify-between items-center pt-1">
              <button onClick={() => setStep(2)} className="text-sm text-text-secondary hover:text-accent transition-colors">← Retour</button>
              <Button onClick={savePlanningAndNext} disabled={savingPlanning}>
                {savingPlanning ? <Loader2 size={15} className="animate-spin" /> : null}
                Enregistrer et continuer
              </Button>
            </div>
          </div>
        )}

        {/* ── Étape 4 — Concurrents (optionnelle) ── */}
        {step === 4 && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Ajouter un concurrent</label>
                <PlaceSearch
                  key={competitors.length}
                  onSelect={place => addCompetitor(place.place_id, place.name)}
                  country={activeBusiness?.country}
                  placeholder="Rechercher une fiche Google (nom du concurrent)"
                />
                {atMaxCompetitors && <p className="text-xs text-text-tertiary mt-1">Limite de votre plan atteinte.</p>}
              </div>

              {competitors.length > 0 && (
                <ul className="divide-y divide-border">
                  {competitors.map(c => (
                    <li key={c.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-text-primary">{c.name || c.place_id}</span>
                      <button onClick={() => removeCompetitor(c.id)}
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors"
                        title="Retirer ce concurrent">
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {quota?.max_competitors != null && (
                <p className="text-xs text-text-tertiary">{competitors.length} / {quota.max_competitors} concurrents suivis</p>
              )}

              {loadingDetected ? (
                <div className="flex items-center gap-2 text-xs text-text-tertiary pt-2 border-t border-border">
                  <Loader2 size={13} className="animate-spin" /> Recherche des concurrents déjà repérés dans vos scans…
                </div>
              ) : detectedList.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-medium text-text-secondary mb-2">Concurrents repérés dans vos scans</p>
                  <div className="flex flex-wrap gap-2">
                    {detectedList.map(d => (
                      <button key={d.place_id} onClick={() => addCompetitor(d.place_id, d.name)} disabled={atMaxCompetitors}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-full border border-border hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus size={12} /> {d.name || d.place_id}
                        {d.best_rank != null && <span className="text-text-tertiary">#{d.best_rank}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <button onClick={() => setStep(3)} className="text-sm text-text-secondary hover:text-accent transition-colors">← Retour</button>
              <Button onClick={() => setStep(5)}>{competitors.length ? 'Continuer' : 'Passer cette étape'}</Button>
            </div>
          </div>
        )}

        {/* ── Étape 5 — Récap & lancement ── */}
        {step === 5 && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-border rounded-2xl divide-y divide-border">
              <RecapRow label="Grille" onEdit={() => setStep(1)}
                value={`${shape === 'circle' ? 'Cercle' : 'Carré'} ${gridSize}×${gridSize} · ${spacing < 1000 ? `${spacing} m` : `${fmtNum(spacing / 1000)} km`} · ${pointCount} points`} />
              <RecapRow label="Mots-clés" onEdit={() => setStep(2)}
                value={keywords.length ? keywords.map(k => k.keyword).join(', ') : 'Aucun'} />
              <RecapRow label="Planning" onEdit={() => setStep(3)}
                value={`${FREQUENCY_LABELS[frequency]} · ${String(runHour).padStart(2, '0')}:00 · ${timezone}`} />
              <RecapRow label="Concurrents" onEdit={() => setStep(4)}
                value={competitors.length ? competitors.map(c => c.name || c.place_id).join(', ') : 'Aucun'} />
            </div>

            {nextRunAt && (
              <p className="text-xs text-text-secondary flex items-center gap-1.5 px-1">
                <Globe size={13} /> Prochain rapport automatique planifié le {fmtDateTime(nextRunAt)}
              </p>
            )}

            {runLaunched ? (
              <div className="bg-accent-light rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-accent flex items-center gap-2">
                  <CheckCircle2 size={16} /> Rapport lancé — {runLaunched.keywords_total} mot{runLaunched.keywords_total > 1 ? 's' : ''}-clé{runLaunched.keywords_total > 1 ? 's' : ''} en cours de scan.
                </span>
                <button onClick={() => navigate('/positionnement/suivi')}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                  Voir les résultats <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-1">
                <button onClick={() => setStep(4)} className="text-sm text-text-secondary hover:text-accent transition-colors">← Retour</button>
                <Button onClick={launchFirstReport} disabled={launchingReport || !keywords.length}>
                  {launchingReport ? <Loader2 size={15} className="animate-spin" /> : null}
                  Lancer un premier rapport maintenant
                </Button>
              </div>
            )}
          </div>
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

function RecapRow({ label, value, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <p className="text-sm text-text-primary truncate">{value}</p>
      </div>
      <button onClick={onEdit} className="shrink-0 text-xs font-medium text-accent hover:underline">Modifier</button>
    </div>
  )
}
