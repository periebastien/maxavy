import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Loader2, Lock, FileSearch, Swords } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import GeogridMap from '../components/GeogridMap'
import CompetitorTable from '../components/GeogridCompetitorTable'
import { TrendControls, TrendChart, LINE_COLORS } from '../components/GeogridTrendChart'
import { RANK_LEGEND } from '../lib/geogrid'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'
import { filterByRange, bucketize, mergeSeriesForChart, bucketKeyOf } from '../lib/geogrid-trend'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

export default function GeogridConcurrentsPage() {
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [keywords, setKeywords] = useState([])
  const [runs, setRuns] = useState([])
  const [competitors, setCompetitors] = useState([])

  const [selectedKeywordId, setSelectedKeywordId] = useState(null)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [scanDetail, setScanDetail] = useState(null) // { scan, points, competitors } — carte + tableau
  const [loadingScanDetail, setLoadingScanDetail] = useState(false)

  const [mineTrend, setMineTrend] = useState([])
  const [competitorsTrend, setCompetitorsTrend] = useState([])
  const [loadingTrend, setLoadingTrend] = useState(false)
  const [rangePreset, setRangePreset] = useState('90d')
  const [granularity, setGranularity] = useState('week')
  const [aggMode, setAggMode] = useState('average')

  const bid = activeBusiness?.id
  const locId = activeLocation?.id

  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError('')
    Promise.all([
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/config?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/keywords?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/runs?business_id=${bid}&location_id=${locId}`),
    ])
      .then(async ([q, cfg, kws, allRuns]) => {
        if (cancelled) return
        setQuota(q)
        setKeywords(kws)
        setSelectedKeywordId(kws.length ? kws[0].id : null)
        const done = allRuns.filter(r => r.status === 'done').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setRuns(done)
        setSelectedRunId(done.length ? done[0].id : null)
        if (q.enabled && cfg?.id) {
          const comps = await api.get(`/api/v1/rank-tracking/competitors?business_id=${bid}&config_id=${cfg.id}`)
          if (cancelled) return
          setCompetitors(comps)
        }
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Détail du scan (mot-clé + rapport) : alimente la carte (heatmap de la fiche) ET le tableau concurrents.
  useEffect(() => {
    if (!bid || !selectedKeywordId || !selectedRunId) { setScanDetail(null); return }
    let cancelled = false
    setLoadingScanDetail(true); setError('')
    api.get(`/api/v1/rank-tracking/runs/${selectedRunId}?business_id=${bid}`)
      .then(async ({ scans }) => {
        const scan = scans.find(s => s.keyword_id === selectedKeywordId)
        if (!scan) { if (!cancelled) setScanDetail(null); return }
        const detail = await api.get(`/api/v1/rank-tracking/scans/${scan.id}?business_id=${bid}`)
        if (!cancelled) setScanDetail(detail)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingScanDetail(false) })
    return () => { cancelled = true }
  }, [bid, selectedKeywordId, selectedRunId])

  // Courbe de comparaison pour le mot-clé sélectionné (tout l'historique).
  useEffect(() => {
    if (!bid || !selectedKeywordId) { setMineTrend([]); setCompetitorsTrend([]); return }
    let cancelled = false
    setLoadingTrend(true)
    Promise.all([
      api.get(`/api/v1/rank-tracking/trend?business_id=${bid}&keyword_id=${selectedKeywordId}`),
      api.get(`/api/v1/rank-tracking/competitors/trend?business_id=${bid}&keyword_id=${selectedKeywordId}`),
    ])
      .then(([mine, comps]) => { if (!cancelled) { setMineTrend(mine); setCompetitorsTrend(comps) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingTrend(false) })
    return () => { cancelled = true }
  }, [bid, selectedKeywordId])

  // ── États de garde ──
  if (!activeBusiness || !activeLocation) {
    return (
      <AppLayout title="Positionnement — Concurrents">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <MapPin size={15} /> Sélectionnez une localisation pour voir la comparaison.
        </div>
      </AppLayout>
    )
  }
  if (loading) {
    return (
      <AppLayout title="Positionnement — Concurrents">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
      </AppLayout>
    )
  }
  if (quota && !quota.enabled) {
    return (
      <AppLayout title="Positionnement — Concurrents">
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
      <AppLayout title="Positionnement — Concurrents">
        <div className="text-center bg-white border border-border rounded-2xl p-12">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <FileSearch size={22} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Aucun rapport pour l'instant</h3>
          <p className="text-sm text-text-secondary mt-1.5 max-w-sm mx-auto">
            Lancez un premier rapport dans Suivi pour pouvoir vous comparer à vos concurrents.
          </p>
          <Link to="/positionnement/configuration" className="mt-5 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 h-9 rounded-lg hover:bg-violet-700 transition-colors">
            Aller à la Configuration
          </Link>
        </div>
      </AppLayout>
    )
  }
  if (!competitors.length) {
    return (
      <AppLayout title="Positionnement — Concurrents">
        <div className="text-center bg-white border border-border rounded-2xl p-12">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <Swords size={22} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Aucun concurrent suivi</h3>
          <p className="text-sm text-text-secondary mt-1.5 max-w-sm mx-auto">
            Ajoutez au moins un concurrent pour comparer votre position à la sienne.
          </p>
          <Link to="/positionnement/configuration?step=4" className="mt-5 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 h-9 rounded-lg hover:bg-violet-700 transition-colors">
            Ajouter des concurrents
          </Link>
        </div>
      </AppLayout>
    )
  }

  const selectedKeyword = keywords.find(kw => kw.id === selectedKeywordId)
  const selectedRun = runs.find(r => r.id === selectedRunId)

  // Courbe : ma fiche (atrp) + chaque concurrent (avg_position).
  const seriesByLabel = {
    'Ma fiche': bucketize(filterByRange(mineTrend.map(s => ({ date: s.scanned_at, value: s.atrp })), rangePreset), granularity, aggMode),
  }
  competitorsTrend.forEach(c => {
    seriesByLabel[c.name || c.place_id] = bucketize(
      filterByRange(c.series.map(s => ({ date: s.scanned_at, value: s.avg_position })), rangePreset), granularity, aggMode
    )
  })
  const chartData = mergeSeriesForChart(seriesByLabel)
  const chartLines = Object.keys(seriesByLabel).map((label, i) => ({ key: label, color: LINE_COLORS[i % LINE_COLORS.length] }))

  // Clic-graphe → rapport (via ma courbe, qui porte run_id + scanned_at).
  const bucketToRun = new Map()
  mineTrend.forEach(pt => {
    if (!pt.run_id) return
    const key = bucketKeyOf(pt.scanned_at, granularity)
    const prev = bucketToRun.get(key)
    if (!prev || new Date(pt.scanned_at) > new Date(prev.date)) bucketToRun.set(key, { runId: pt.run_id, date: pt.scanned_at })
  })
  const onDayClick = payload => {
    const hit = payload?.key && bucketToRun.get(payload.key)
    if (hit && runs.some(r => r.id === hit.runId)) setSelectedRunId(hit.runId)
  }

  const mapData = scanDetail
    ? { center: { lat: Number(scanDetail.scan.center_lat), lng: Number(scanDetail.scan.center_lng) }, points: scanDetail.points }
    : null

  return (
    <AppLayout title="Positionnement — Concurrents">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedKeywordId || ''} onChange={e => setSelectedKeywordId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
              {keywords.map(kw => <option key={kw.id} value={kw.id}>{kw.keyword}</option>)}
            </select>
            <select value={selectedRunId || ''} onChange={e => setSelectedRunId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
              {runs.map(r => (
                <option key={r.id} value={r.id}>{fmtDate(r.createdAt)}{r.has_failures ? ' (partiel)' : ''}</option>
              ))}
            </select>
            {loadingScanDetail && <Loader2 size={15} className="animate-spin text-accent" />}
          </div>
          <Link to="/positionnement/configuration?step=4"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors">
            <Swords size={14} /> Gérer les concurrents
          </Link>
        </div>

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Graphe de comparaison pleine largeur */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Comparaison · {selectedKeyword?.keyword}
            </h3>
            <TrendControls rangePreset={rangePreset} setRangePreset={setRangePreset}
              granularity={granularity} setGranularity={setGranularity}
              aggMode={aggMode} setAggMode={setAggMode} loading={loadingTrend} />
          </div>
          <TrendChart data={chartData} lines={chartLines} height={420} onDayClick={onDayClick} />
          <p className="text-xs text-text-tertiary">Cliquez sur un point de la courbe pour afficher la carte de ce jour ci-dessous.</p>
        </div>

        {/* Carte pleine largeur (heatmap de ma fiche) */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Ma carte · {selectedKeyword?.keyword}
            {selectedRun && <span className="font-normal text-text-tertiary"> · {fmtDate(selectedRun.createdAt)}</span>}
          </h3>
          {loadingScanDetail ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
          ) : mapData && mapData.points?.length > 0 ? (
            <>
              <GeogridMap center={mapData.center} points={mapData.points} heightClass="h-[600px]" />
              <RankLegend />
            </>
          ) : (
            <p className="text-sm text-text-tertiary py-10 text-center">Aucun scan pour ce mot-clé dans ce rapport.</p>
          )}
        </div>

        {/* Tableau « ma fiche + concurrents » du rapport sélectionné */}
        {scanDetail && <CompetitorTable scan={scanDetail.scan} competitors={scanDetail.competitors} />}
      </div>
    </AppLayout>
  )
}
