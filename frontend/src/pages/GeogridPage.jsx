import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Target, Plus, Trash2, Loader2, Lock, RefreshCw } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MetricCard from '../components/common/MetricCard'
import GeogridMap from '../components/GeogridMap'
import { RANK_LEGEND } from '../lib/geogrid'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const sleep = ms => new Promise(r => setTimeout(r, ms))
const RUNNING = s => s === 'running' || s === 'pending'

export default function GeogridPage() {
  const navigate = useNavigate()
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const [quota, setQuota] = useState(null)
  const [keywords, setKeywords] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null) // { scan, points }
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [error, setError] = useState('')

  const pollTokenRef = useRef(0)

  const bid = activeBusiness?.id
  const locId = activeLocation?.id
  const hasCoords = activeLocation && activeLocation.lat != null && activeLocation.lng != null

  // Invalide tout polling en cours au démontage
  useEffect(() => () => { pollTokenRef.current++ }, [])

  // Charge quota + mots-clés à chaque changement de localisation
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError(''); setDetail(null); setSelectedId(null)
    Promise.all([
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}`),
      api.get(`/api/v1/rank-tracking/keywords?business_id=${bid}&location_id=${locId}`),
    ])
      .then(([q, kws]) => {
        if (cancelled) return
        setQuota(q)
        setKeywords(kws)
        setSelectedId(kws[0]?.id || null)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Charge le dernier scan du mot-clé sélectionné
  useEffect(() => {
    pollTokenRef.current++ // stoppe un polling d'un mot-clé précédent
    setScanning(false); setScanMsg('')
    if (!selectedId || !bid) { setDetail(null); return }
    let cancelled = false
    setLoadingDetail(true); setError('')
    api.get(`/api/v1/rank-tracking/scans?business_id=${bid}&keyword_id=${selectedId}`)
      .then(async scans => {
        if (cancelled) return
        if (!scans.length) { setDetail(null); return }
        const d = await api.get(`/api/v1/rank-tracking/scans/${scans[0].id}?business_id=${bid}`)
        if (cancelled) return
        setDetail(d)
        if (RUNNING(d.scan.status)) pollScan(d.scan.id)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingDetail(false) })
    return () => { cancelled = true }
  }, [selectedId, bid])

  async function pollScan(scanId) {
    const myToken = ++pollTokenRef.current
    setScanning(true); setError('')
    try {
      for (let i = 0; i < 45; i++) {
        if (pollTokenRef.current !== myToken) return
        let scan
        try {
          scan = await api.post(`/api/v1/rank-tracking/scans/${scanId}/refresh?business_id=${bid}`)
        } catch (e) {
          if (pollTokenRef.current === myToken) setError(e.message)
          return
        }
        if (pollTokenRef.current !== myToken) return
        setScanMsg(`Scan en cours… ${scan.points_ranked || 0}/${scan.points_total || 0} points relevés`)
        if (scan.status === 'done' || scan.status === 'failed') {
          const d = await api.get(`/api/v1/rank-tracking/scans/${scanId}?business_id=${bid}`)
          if (pollTokenRef.current !== myToken) return
          setDetail(d)
          if (scan.status === 'failed') setError('Le scan a échoué : ' + (scan.error_message || 'raison inconnue'))
          return
        }
        await sleep(4000)
      }
    } finally {
      if (pollTokenRef.current === myToken) { setScanning(false); setScanMsg('') }
    }
  }

  async function runScan() {
    if (!selectedId || scanning) return
    setError('')
    try {
      const scan = await api.post(`/api/v1/rank-tracking/scans?business_id=${bid}`, { keyword_id: selectedId })
      pollScan(scan.id)
    } catch (e) {
      setError(e.message)
    }
  }

  async function addKeyword(e) {
    e.preventDefault()
    const kw = newKeyword.trim()
    if (!kw) return
    setError('')
    try {
      const created = await api.post(
        `/api/v1/rank-tracking/keywords?business_id=${bid}`,
        { location_id: locId, keyword: kw }
      )
      setKeywords(k => [...k, created])
      setNewKeyword('')
      setSelectedId(created.id)
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
      const remaining = keywords.filter(k => k.id !== id)
      setKeywords(remaining)
      setQuota(q => (q ? { ...q, used: Math.max(0, (q.used || 0) - 1) } : q))
      if (selectedId === id) setSelectedId(remaining[0]?.id || null)
    } catch (e) {
      setError(e.message)
    }
  }

  // ── États de garde ──
  if (!activeBusiness || !activeLocation) {
    return (
      <AppLayout title="Positionnement">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <MapPin size={15} />
          Sélectionnez une localisation pour suivre son positionnement local.
        </div>
      </AppLayout>
    )
  }

  if (loading) {
    return (
      <AppLayout title="Positionnement">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
      </AppLayout>
    )
  }

  if (quota && !quota.enabled) {
    return (
      <AppLayout title="Positionnement">
        <div className="max-w-md mx-auto text-center bg-white border border-border rounded-2xl p-10 mt-8">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <Lock size={22} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Suivi de positionnement</h2>
          <p className="text-sm text-text-secondary mt-2">
            Mesurez votre classement sur Google Maps mot-clé par mot-clé, partout autour de votre établissement.
            Cette fonctionnalité n'est pas incluse dans votre plan actuel.
          </p>
          <button
            onClick={() => navigate('/pricing')}
            className="mt-5 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 h-9 rounded-lg hover:bg-violet-700 transition-colors"
          >
            Voir les plans
          </button>
        </div>
      </AppLayout>
    )
  }

  const atMax = quota && quota.max_keywords != null && (quota.used || 0) >= quota.max_keywords
  const scan = detail?.scan
  const running = scanning || (scan && RUNNING(scan.status))

  return (
    <AppLayout title="Positionnement">
      <div className="max-w-5xl space-y-5">

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {!hasCoords && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            Cette localisation n'a pas de coordonnées GPS — le scan ne peut pas être centré correctement.
          </div>
        )}

        {/* Barre de gestion des mots-clés */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Mot-clé suivi</label>
              {keywords.length > 0 ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedId || ''}
                    onChange={e => setSelectedId(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer"
                  >
                    {keywords.map(k => (
                      <option key={k.id} value={k.id}>{k.keyword}</option>
                    ))}
                  </select>
                  {selectedId && (
                    <button
                      onClick={() => removeKeyword(selectedId)}
                      className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-border text-text-tertiary hover:text-danger hover:border-danger transition-colors"
                      title="Supprimer ce mot-clé"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary h-9 flex items-center">Aucun mot-clé suivi pour l'instant.</p>
              )}
            </div>

            <button
              onClick={runScan}
              disabled={!selectedId || running || !hasCoords}
              className="inline-flex items-center justify-center gap-2 bg-accent text-white text-sm font-medium px-4 h-9 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {running ? 'Scan en cours…' : 'Scanner maintenant'}
            </button>
          </div>

          {/* Ajout d'un mot-clé */}
          <form onSubmit={addKeyword} className="flex items-center gap-2 pt-1">
            <input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="Ajouter un mot-clé (ex : plombier Lyon)"
              disabled={atMax}
              className="flex-1 h-9 px-3 rounded-lg border border-border text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={atMax || !newKeyword.trim()}
              className="inline-flex items-center gap-1.5 bg-white border border-border text-text-primary text-sm font-medium px-3 h-9 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={15} /> Ajouter
            </button>
          </form>
          {quota && quota.max_keywords != null && (
            <p className="text-xs text-text-tertiary">
              {quota.used || 0} / {quota.max_keywords} mots-clés utilisés
              {atMax && ' — limite de votre plan atteinte'}
            </p>
          )}
        </div>

        {scanMsg && (
          <div className="flex items-center gap-2 text-sm text-accent bg-accent-light rounded-lg px-4 py-3">
            <Loader2 size={15} className="animate-spin" /> {scanMsg}
          </div>
        )}

        {/* Résultats du scan */}
        {loadingDetail ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
        ) : !selectedId ? (
          <EmptyState icon={<Target size={22} />} title="Suivez votre premier mot-clé"
            text="Ajoutez un mot-clé ci-dessus, puis lancez un scan pour voir votre classement local point par point." />
        ) : !scan ? (
          <EmptyState icon={<RefreshCw size={22} />} title="Aucun scan pour ce mot-clé"
            text="Cliquez sur « Scanner maintenant » pour mesurer votre positionnement autour de l'établissement." />
        ) : (
          <>
            {/* Métriques */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Rang moyen (visible)" value={scan.arp ?? '—'} sub="ARP — là où vous apparaissez" />
              <MetricCard label="Rang moyen (couverture)" value={scan.atrp ?? '—'} sub="ATRP — toute la grille" />
              <MetricCard label="Part de voix" value={scan.solv != null ? `${Math.round(scan.solv)}%` : '—'} sub="SoLV — points en Top 3" />
              <MetricCard
                label="Note de la fiche"
                value={scan.rating_snapshot != null ? scan.rating_snapshot : '—'}
                sub={scan.review_count_snapshot != null ? `${scan.review_count_snapshot} avis` : 'au moment du scan'}
              />
            </div>

            {/* Carte */}
            {detail.points?.length > 0 && (
              <GeogridMap
                center={{ lat: Number(scan.center_lat), lng: Number(scan.center_lng) }}
                points={detail.points}
              />
            )}

            {/* Légende + date */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-tertiary">
              <div className="flex flex-wrap items-center gap-4">
                {RANK_LEGEND.map(l => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
              <span>
                Grille {scan.grid_size}×{scan.grid_size} · {scan.points_ranked}/{scan.points_total} points classés
                {scan.scanned_at && ` · ${new Date(scan.scanned_at).toLocaleString('fr-FR')}`}
              </span>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="text-center bg-white border border-border rounded-2xl p-10">
      <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary mt-1.5 max-w-sm mx-auto">{text}</p>
    </div>
  )
}
