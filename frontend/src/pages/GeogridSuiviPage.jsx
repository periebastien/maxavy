import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MapPin, Loader2, Lock, ArrowUp, ArrowDown, Minus, FileSearch } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'
import { RANGE_PRESETS, GRANULARITIES, AGG_MODES, filterByRange, bucketize, mergeSeriesForChart } from '../lib/geogrid-trend'

// Palette cyclique pour les lignes du graphe multi-mots-clés (cycle si plus de mots-clés que de couleurs).
const LINE_COLORS = ['#7C5CFC', '#1D9E75', '#E8833B', '#3B82F6', '#E24B4A', '#0EA5A5', '#D946A8', '#84931D']

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

  // Courbe multi-mots-clés
  const [keywords, setKeywords] = useState([])
  const [trendByKeyword, setTrendByKeyword] = useState({}) // keyword_id -> [{scanned_at, atrp, ...}]
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [rangePreset, setRangePreset] = useState('90d')
  const [granularity, setGranularity] = useState('week')
  const [aggMode, setAggMode] = useState('average')

  const bid = activeBusiness?.id
  const locId = activeLocation?.id

  // Charge quota + liste des rapports terminés + mots-clés (indépendant du rapport sélectionné : la
  // courbe montre tout l'historique, pas juste les mots-clés du rapport affiché dans le tableau).
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError(''); setRuns([]); setSelectedRunId(null); setRunDetail(null); setPreviousScans(null)
    Promise.all([
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/runs?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/keywords?business_id=${bid}&location_id=${locId}`),
    ])
      .then(([q, allRuns, kws]) => {
        if (cancelled) return
        setQuota(q)
        setKeywords(kws)
        const done = allRuns.filter(r => r.status === 'done').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setRuns(done)
        if (done.length) setSelectedRunId(done[0].id)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Historique complet par mot-clé (pour la courbe) — 1 appel par mot-clé, une seule fois par liste.
  useEffect(() => {
    if (!bid || !keywords.length) { setTrendByKeyword({}); return }
    let cancelled = false
    setLoadingTrend(true)
    Promise.all(keywords.map(kw =>
      api.get(`/api/v1/rank-tracking/trend?business_id=${bid}&keyword_id=${kw.id}`).then(trend => [kw.id, trend])
    ))
      .then(entries => { if (!cancelled) setTrendByKeyword(Object.fromEntries(entries)) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingTrend(false) })
    return () => { cancelled = true }
  }, [bid, keywords])

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

  const seriesByLabel = {}
  keywords.forEach(kw => {
    const raw = (trendByKeyword[kw.id] || []).map(s => ({ date: s.scanned_at, value: s.atrp }))
    seriesByLabel[kw.keyword] = bucketize(filterByRange(raw, rangePreset), granularity, aggMode)
  })
  const chartData = mergeSeriesForChart(seriesByLabel)

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

        {/* Courbe multi-mots-clés */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={rangePreset} onChange={e => setRangePreset(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
              {RANGE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={granularity} onChange={e => setGranularity(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
              {GRANULARITIES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <select value={aggMode} onChange={e => setAggMode(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
              {AGG_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {loadingTrend && <Loader2 size={15} className="animate-spin text-accent" />}
          </div>

          {chartData.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF2" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B6B78' }} />
                <YAxis reversed allowDecimals={false} tick={{ fontSize: 12, fill: '#6B6B78' }}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B6B78' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {keywords.map((kw, i) => (
                  <Line key={kw.id} type="monotone" dataKey={kw.keyword} stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-10">Pas encore assez de données pour tracer une courbe.</p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
