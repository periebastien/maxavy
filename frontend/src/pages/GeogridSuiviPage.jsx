import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Loader2, Lock, ArrowUp, ArrowDown, Minus, FileSearch } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Flèche d'évolution vs le rapport précédent — atrp est un RANG (plus bas = mieux), donc une baisse du
// chiffre est une amélioration (flèche verte vers le haut), l'inverse une dégradation (rouge, vers le bas).
function EvolutionArrow({ current, previous }) {
  if (current == null || previous == null) return <span className="text-text-tertiary text-xs">—</span>
  const delta = round2(current - previous)
  if (Math.abs(delta) < 0.01) return <Minus size={14} className="text-text-tertiary" />
  const improved = delta < 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${improved ? 'text-success' : 'text-danger'}`}>
      {improved ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      {fmtNum(Math.abs(delta))}
    </span>
  )
}

function round2(n) { return Math.round(n * 100) / 100 }
function fmtNum(n) {
  const r = round2(n)
  return (Number.isInteger(r) ? r : r.toFixed(1)).toString().replace('.', ',')
}

export default function GeogridSuiviPage() {
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [runs, setRuns] = useState([])          // rapports terminés, plus récent d'abord
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [runDetail, setRunDetail] = useState(null)     // { run, scans } du rapport sélectionné
  const [previousScans, setPreviousScans] = useState(null) // scans du rapport juste avant (pour les flèches)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const bid = activeBusiness?.id
  const locId = activeLocation?.id

  // Charge quota + liste des rapports terminés
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError(''); setRuns([]); setSelectedRunId(null); setRunDetail(null); setPreviousScans(null)
    Promise.all([
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/runs?business_id=${bid}&location_id=${locId}`),
    ])
      .then(([q, allRuns]) => {
        if (cancelled) return
        setQuota(q)
        const done = allRuns.filter(r => r.status === 'done').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setRuns(done)
        if (done.length) setSelectedRunId(done[0].id)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Charge le détail du rapport sélectionné + celui juste avant (pour l'évolution)
  useEffect(() => {
    if (!bid || !selectedRunId) { setRunDetail(null); setPreviousScans(null); return }
    let cancelled = false
    setLoadingDetail(true); setError('')

    const idx = runs.findIndex(r => r.id === selectedRunId)
    const previousRun = idx >= 0 ? runs[idx + 1] : null

    Promise.all([
      api.get(`/api/v1/rank-tracking/runs/${selectedRunId}?business_id=${bid}`),
      previousRun ? api.get(`/api/v1/rank-tracking/runs/${previousRun.id}?business_id=${bid}`) : Promise.resolve(null),
    ])
      .then(([detail, prevDetail]) => {
        if (cancelled) return
        setRunDetail(detail)
        setPreviousScans(prevDetail?.scans || [])
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingDetail(false) })
    return () => { cancelled = true }
  }, [bid, selectedRunId, runs])

  // ── États de garde ──
  if (!activeBusiness || !activeLocation) {
    return (
      <AppLayout title="Positionnement — Suivi">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <MapPin size={15} /> Sélectionnez une localisation pour voir son suivi.
        </div>
      </AppLayout>
    )
  }
  if (loading) {
    return (
      <AppLayout title="Positionnement — Suivi">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
      </AppLayout>
    )
  }
  if (quota && !quota.enabled) {
    return (
      <AppLayout title="Positionnement — Suivi">
        <div className="max-w-md mx-auto text-center bg-white border border-border rounded-2xl p-10 mt-8">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <Lock size={22} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Suivi de positionnement</h2>
          <p className="text-sm text-text-secondary mt-2">Cette fonctionnalité n'est pas incluse dans votre plan actuel.</p>
        </div>
      </AppLayout>
    )
  }

  if (!runs.length) {
    return (
      <AppLayout title="Positionnement — Suivi">
        <div className="text-center bg-white border border-border rounded-2xl p-12">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <FileSearch size={22} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Aucun rapport pour l'instant</h3>
          <p className="text-sm text-text-secondary mt-1.5 max-w-sm mx-auto">
            Configurez votre grille et lancez un premier rapport pour voir vos résultats ici.
          </p>
          <Link to="/positionnement/configuration" className="mt-5 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 h-9 rounded-lg hover:bg-violet-700 transition-colors">
            Aller à la Configuration
          </Link>
        </div>
      </AppLayout>
    )
  }

  const previousByKeyword = new Map((previousScans || []).map(s => [s.keyword_id, s]))

  return (
    <AppLayout title="Positionnement — Suivi">
      <div className="max-w-4xl space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text-secondary shrink-0">Rapport</label>
          <select value={selectedRunId || ''} onChange={e => setSelectedRunId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {fmtDate(r.createdAt)}{r.has_failures ? ' (partiel)' : ''}
              </option>
            ))}
          </select>
          {loadingDetail && <Loader2 size={15} className="animate-spin text-accent" />}
        </div>

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {runDetail && (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
                  <th className="px-5 py-3">Mot-clé</th>
                  <th className="px-3 py-3">Position moyenne</th>
                  <th className="px-3 py-3">Top 3</th>
                  <th className="px-3 py-3">Top 10</th>
                  <th className="px-3 py-3">Top 20</th>
                  <th className="px-3 py-3">Évolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runDetail.scans.map(scan => (
                  <tr key={scan.id}>
                    <td className="px-5 py-3 text-text-primary font-medium">{scan.keyword}</td>
                    <td className="px-3 py-3 text-text-primary">{scan.atrp ?? '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{scan.points_top3 ?? '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{scan.points_top10 ?? '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{scan.points_top20 ?? '—'}</td>
                    <td className="px-3 py-3">
                      <EvolutionArrow current={scan.atrp} previous={previousByKeyword.get(scan.keyword_id)?.atrp} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
