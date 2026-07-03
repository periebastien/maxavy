import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Loader2, Lock, ArrowUp, ArrowDown, Minus, FileSearch } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MetricCard from '../components/common/MetricCard'
import GeogridMap from '../components/GeogridMap'
import CompetitorTable from '../components/GeogridCompetitorTable'
import { TrendControls, TrendChart, LINE_COLORS } from '../components/GeogridTrendChart'
import { RANK_LEGEND } from '../lib/geogrid'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'
import { filterByRange, bucketize, mergeSeriesForChart, bucketKeyOf } from '../lib/geogrid-trend'

const ALL = '' // valeur sentinelle du sélecteur = « Moyenne globale » (toutes les requêtes)

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function round2(n) { return Math.round(n * 100) / 100 }
function fmtNum(n) {
  const r = round2(n)
  return (Number.isInteger(r) ? r : r.toFixed(1)).toString().replace('.', ',')
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

function RankLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-text-tertiary">
      {RANK_LEGEND.map(l => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  )
}

export default function GeogridSuiviPage() {
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [runs, setRuns] = useState([])              // rapports terminés, plus récent d'abord
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [runDetail, setRunDetail] = useState(null)  // { run, scans } du rapport sélectionné (tableau + évolution)
  const [previousScans, setPreviousScans] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [keywords, setKeywords] = useState([])
  const [trendByKeyword, setTrendByKeyword] = useState({}) // keyword_id -> [{scanned_at, atrp, run_id, ...}]
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [rangePreset, setRangePreset] = useState('90d')
  const [granularity, setGranularity] = useState('week')
  const [aggMode, setAggMode] = useState('average')

  // Sélection courante : '' = Moyenne globale, sinon un keyword_id. Pilote graphe ET carte.
  const [selectedKeywordId, setSelectedKeywordId] = useState(ALL)
  const [scanDetail, setScanDetail] = useState(null)       // { scan, points, competitors } (mode mot-clé)
  const [loadingScanDetail, setLoadingScanDetail] = useState(false)
  const [averageMap, setAverageMap] = useState(null)       // { center, points } (mode Moyenne globale)
  const [loadingAverageMap, setLoadingAverageMap] = useState(false)

  const bid = activeBusiness?.id
  const locId = activeLocation?.id

  // Charge quota + rapports terminés + mots-clés.
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError(''); setRuns([]); setSelectedRunId(null); setRunDetail(null); setPreviousScans(null)
    setSelectedKeywordId(ALL); setScanDetail(null); setAverageMap(null)
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

  // Historique par mot-clé (courbe) — 1 appel par mot-clé.
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

  // Détail du rapport sélectionné + le précédent (tableau d'évolution).
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

  // Carte : mode mot-clé → scan détaillé (points + concurrents) ; mode Moyenne globale → heatmap moyenne.
  useEffect(() => {
    if (!bid || !selectedRunId) { setScanDetail(null); setAverageMap(null); return }
    let cancelled = false

    if (selectedKeywordId === ALL) {
      setScanDetail(null); setLoadingAverageMap(true)
      api.get(`/api/v1/rank-tracking/runs/${selectedRunId}/average-map?business_id=${bid}`)
        .then(m => { if (!cancelled) setAverageMap(m) })
        .catch(e => { if (!cancelled) setError(e.message) })
        .finally(() => { if (!cancelled) setLoadingAverageMap(false) })
    } else if (runDetail) {
      setAverageMap(null)
      const scan = runDetail.scans.find(s => s.keyword_id === selectedKeywordId)
      if (!scan) { setScanDetail(null); return }
      setLoadingScanDetail(true)
      api.get(`/api/v1/rank-tracking/scans/${scan.id}?business_id=${bid}`)
        .then(detail => { if (!cancelled) setScanDetail(detail) })
        .catch(e => { if (!cancelled) setError(e.message) })
        .finally(() => { if (!cancelled) setLoadingScanDetail(false) })
    }
    return () => { cancelled = true }
  }, [bid, selectedRunId, selectedKeywordId, runDetail])

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

  const selectedKeyword = keywords.find(kw => kw.id === selectedKeywordId)
  const selectedRun = runs.find(r => r.id === selectedRunId)
  const isGlobal = selectedKeywordId === ALL
  const previousByKeyword = new Map((previousScans || []).map(s => [s.keyword_id, s]))

  // Courbe : mode global = 1 ligne par mot-clé ; mode mot-clé = 1 seule ligne.
  const seriesByLabel = {}
  const chartKeywords = isGlobal ? keywords : (selectedKeyword ? [selectedKeyword] : [])
  chartKeywords.forEach(kw => {
    const raw = (trendByKeyword[kw.id] || []).map(s => ({ date: s.scanned_at, value: s.atrp }))
    seriesByLabel[kw.keyword] = bucketize(filterByRange(raw, rangePreset), granularity, aggMode)
  })
  const chartData = mergeSeriesForChart(seriesByLabel)
  const chartLines = chartKeywords.map((kw, i) => ({ key: kw.keyword, color: LINE_COLORS[i % LINE_COLORS.length] }))

  // Mapping clic-graphe → rapport : clé de bucket (scanned_at) → run le plus récent de ce bucket.
  const bucketToRun = new Map()
  Object.values(trendByKeyword).forEach(series => {
    series.forEach(pt => {
      if (!pt.run_id) return
      const key = bucketKeyOf(pt.scanned_at, granularity)
      const prev = bucketToRun.get(key)
      if (!prev || new Date(pt.scanned_at) > new Date(prev.date)) bucketToRun.set(key, { runId: pt.run_id, date: pt.scanned_at })
    })
  })
  const onDayClick = payload => {
    const hit = payload?.key && bucketToRun.get(payload.key)
    if (hit && runs.some(r => r.id === hit.runId)) setSelectedRunId(hit.runId)
  }

  const mapData = isGlobal
    ? averageMap
    : (scanDetail ? { center: { lat: Number(scanDetail.scan.center_lat), lng: Number(scanDetail.scan.center_lng) }, points: scanDetail.points } : null)
  const mapLoading = isGlobal ? loadingAverageMap : loadingScanDetail

  return (
    <AppLayout title="Positionnement — Suivi">
      <div className="space-y-4">
        {/* Contrôles : sélection mot-clé (dont Moyenne globale) + rapport */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedKeywordId} onChange={e => setSelectedKeywordId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
            <option value={ALL}>Moyenne globale (toutes les requêtes)</option>
            {keywords.map(kw => <option key={kw.id} value={kw.id}>{kw.keyword}</option>)}
          </select>
          <select value={selectedRunId || ''} onChange={e => setSelectedRunId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
            {runs.map(r => (
              <option key={r.id} value={r.id}>{fmtDate(r.createdAt)}{r.has_failures ? ' (partiel)' : ''}</option>
            ))}
          </select>
          {loadingDetail && <Loader2 size={15} className="animate-spin text-accent" />}
        </div>

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Graphe pleine largeur */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Évolution · {isGlobal ? 'Moyenne globale' : selectedKeyword?.keyword}
            </h3>
            <TrendControls rangePreset={rangePreset} setRangePreset={setRangePreset}
              granularity={granularity} setGranularity={setGranularity}
              aggMode={aggMode} setAggMode={setAggMode} loading={loadingTrend} />
          </div>
          <TrendChart data={chartData} lines={chartLines} height={420} onDayClick={onDayClick} />
          <p className="text-xs text-text-tertiary">Cliquez sur un point de la courbe pour afficher la carte de ce jour ci-dessous.</p>
        </div>

        {/* Carte pleine largeur */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Carte · {isGlobal ? 'Moyenne globale' : selectedKeyword?.keyword}
            {selectedRun && <span className="font-normal text-text-tertiary"> · {fmtDate(selectedRun.createdAt)}</span>}
          </h3>
          {mapLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
          ) : mapData && mapData.points?.length > 0 ? (
            <>
              <GeogridMap center={mapData.center} points={mapData.points} heightClass="h-[600px]" />
              <RankLegend />
            </>
          ) : (
            <p className="text-sm text-text-tertiary py-10 text-center">Aucune donnée cartographique pour ce rapport.</p>
          )}
        </div>

        {/* Métriques + concurrents (mode mot-clé uniquement) */}
        {!isGlobal && scanDetail && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Position moyenne (visible)" value={scanDetail.scan.arp ?? '—'} sub="ARP — là où vous apparaissez" />
              <MetricCard label="Position moyenne (couverture)" value={scanDetail.scan.atrp ?? '—'} sub="ATRP — toute la grille" />
              <MetricCard label="Part de voix" value={scanDetail.scan.solv != null ? `${Math.round(scanDetail.scan.solv)}%` : '—'} sub="SoLV — points en Top 3" />
              <MetricCard label="Note de la fiche" value={scanDetail.scan.rating_snapshot ?? '—'}
                sub={scanDetail.scan.review_count_snapshot != null ? `${scanDetail.scan.review_count_snapshot} avis` : 'au moment du scan'} />
            </div>
            <CompetitorTable scan={scanDetail.scan} competitors={scanDetail.competitors} />
          </>
        )}

        {/* Tableau d'évolution par mot-clé (rapport sélectionné) — clic = focus sur ce mot-clé */}
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
                  <tr key={scan.id} onClick={() => setSelectedKeywordId(scan.keyword_id)}
                    className={`cursor-pointer transition-colors ${scan.keyword_id === selectedKeywordId ? 'bg-accent-light/40' : 'hover:bg-bg-page'}`}>
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
