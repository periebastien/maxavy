import { useState, useEffect } from 'react'
import { MapPin, Loader2, Lock, Trash2, Plus } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MetricCard from '../components/common/MetricCard'
import PlaceSearch from '../components/common/PlaceSearch'
import { TrendChart, LINE_COLORS } from '../components/GeogridTrendChart'
import { RANK_PALETTE } from '../lib/rank-palette'
import { useBusiness } from '../contexts/BusinessContext'
import { useLocations } from '../contexts/LocationContext'
import api from '../lib/api'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function fmtDate(iso) {
  if (!iso) return 'jamais'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Classement d'un mois : le plus d'avis = rang 1 (meilleur). Rangs "denses" (ex-æquo partagent le rang,
// le suivant est +1). Un mois à 0 avis = pas de rang (cellule neutre, non colorée — rien à départager).
function monthPositions(counts) {
  const distinctDesc = [...new Set(counts.filter(c => c > 0))].sort((a, b) => b - a)
  const rankByCount = new Map(distinctDesc.map((c, i) => [c, i + 1]))
  return counts.map(c => (c > 0 ? rankByCount.get(c) : null))
}

// Couleur de cellule selon le classement RELATIF du mois (plutôt que les seuils absolus top3/10/20 du
// geogrid, non discriminants à faible nombre de concurrents) : leader = vert, dernier ayant des avis =
// rouge, entre-deux = orange. Réutilise la charte partagée RANK_PALETTE. Mois à 0 avis partout = neutre.
function monthCellStyles(counts) {
  const positions = monthPositions(counts)
  const maxPos = positions.reduce((m, p) => (p != null && p > m ? p : m), 0)
  return positions.map(p => {
    if (p == null) return null
    const b = p === 1 ? RANK_PALETTE.top1 : (maxPos > 1 && p === maxPos ? RANK_PALETTE.low : RANK_PALETTE.mid)
    return { backgroundColor: b.soft, color: b.text }
  })
}

export default function ReviewsConcurrentsPage() {
  const { activeBusiness } = useBusiness()
  const { activeLocation } = useLocations() || {}

  const bid = activeBusiness?.id
  const locId = activeLocation?.id

  const [stats, setStats] = useState(null)
  const [year, setYear] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gated, setGated] = useState(false)
  const [error, setError] = useState('')

  const [configId, setConfigId] = useState(null)
  const [rtQuota, setRtQuota] = useState(null)
  const [competitors, setCompetitors] = useState([])

  const [detectedList, setDetectedList] = useState([])
  const [detectedLoaded, setDetectedLoaded] = useState(false)

  const [syncingPlaceId, setSyncingPlaceId] = useState(null)

  // Chargement initial : stats + quota + config (+ concurrents si config déjà provisionnée).
  useEffect(() => {
    if (!bid || !locId) return
    let cancelled = false
    setLoading(true); setError(''); setGated(false)
    Promise.all([
      api.get(`/api/v1/reviews/competitors/stats?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/quota?business_id=${bid}&location_id=${locId}`),
      api.get(`/api/v1/rank-tracking/config?business_id=${bid}&location_id=${locId}`),
    ])
      .then(async ([s, q, cfg]) => {
        if (cancelled) return
        setStats(s); setYear(s.year); setRtQuota(q); setConfigId(cfg?.id || null)
        if (cfg?.id) {
          const comps = await api.get(`/api/v1/rank-tracking/competitors?business_id=${bid}&config_id=${cfg.id}`)
          if (cancelled) return
          setCompetitors(comps)
        }
      })
      .catch(e => { if (!cancelled) { if (e.status === 403) setGated(true); else setError(e.message) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bid, locId])

  // Changement d'année : ne refetch que si `year` diverge des données déjà chargées (évite un appel
  // redondant juste après le chargement initial, qui pose lui-même year = stats.year dans le même batch).
  useEffect(() => {
    if (!bid || !locId || !year) return
    if (stats && stats.year === year) return
    api.get(`/api/v1/reviews/competitors/stats?business_id=${bid}&location_id=${locId}&year=${year}`)
      .then(setStats)
      .catch(e => setError(e.message))
  }, [year])

  // Concurrents détectés (suggestions du module Positionnement) — best-effort, chargé une seule fois.
  useEffect(() => {
    if (!configId || detectedLoaded) return
    api.get(`/api/v1/rank-tracking/competitors/detected?business_id=${bid}&config_id=${configId}`)
      .then(list => { setDetectedList(list); setDetectedLoaded(true) })
      .catch(() => {})
  }, [configId, detectedLoaded])

  async function addCompetitor(place_id, name) {
    try {
      const created = await api.post(`/api/v1/rank-tracking/competitors?business_id=${bid}`, { config_id: configId, place_id, name })
      setCompetitors(c => [...c, created])
      setDetectedList(d => d.filter(x => x.place_id !== place_id))
      setSyncingPlaceId(place_id)
      await api.post(`/api/v1/reviews/competitors/sync?business_id=${bid}`, { location_id: locId, place_id })
      // Backfill priority ~1 min côté cron — on poll jusqu'à ~90s pour voir la série apparaître. L'ajout
      // a déjà réussi à ce stade : un raté réseau transitoire pendant le poll ne doit pas remonter comme
      // une erreur d'ajout, juste retenter au tour suivant.
      const deadline = Date.now() + 90000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 5000))
        try {
          const s = await api.get(`/api/v1/reviews/competitors/stats?business_id=${bid}&location_id=${locId}&year=${year}`)
          setStats(s)
          if (s.series.some(x => x.key === place_id)) break
        } catch { /* transitoire — on retente au prochain tour */ }
      }
    } catch (e) { setError(e.message) } finally { setSyncingPlaceId(null) }
  }

  async function removeCompetitor(id) {
    try {
      await api.delete(`/api/v1/rank-tracking/competitors/${id}?business_id=${bid}`)
      setCompetitors(c => c.filter(x => x.id !== id))
      // La série ne disparaît des stats qu'après la prochaine réconciliation du cron (~1 min), pas ici.
      const s = await api.get(`/api/v1/reviews/competitors/stats?business_id=${bid}&location_id=${locId}&year=${year}`)
      setStats(s)
    } catch (e) { setError(e.message) }
  }

  // ── États de garde ──
  if (!activeBusiness || !activeLocation) {
    return (
      <AppLayout title="Avis — Concurrents">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <MapPin size={15} /> Sélectionnez une localisation pour voir la comparaison.
        </div>
      </AppLayout>
    )
  }
  if (loading) {
    return (
      <AppLayout title="Avis — Concurrents">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
      </AppLayout>
    )
  }
  if (gated) {
    return (
      <AppLayout title="Avis — Concurrents">
        <div className="max-w-md mx-auto text-center bg-white border border-border rounded-2xl p-10 mt-8">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mx-auto mb-4">
            <Lock size={22} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Suivi des avis de la concurrence</h2>
          <p className="text-sm text-text-secondary mt-2">Le suivi des avis de la concurrence n'est pas inclus dans votre plan actuel.</p>
        </div>
      </AppLayout>
    )
  }

  // Accesseurs UTC : les labels de mois viennent du backend en UTC (date_trunc côté Postgres, session UTC
  // vérifiée en réel — voir reviews.service.js), les accesseurs locaux décaleraient le mois en cours près
  // d'une frontière de mois selon le fuseau du navigateur (piège déjà rencontré, évité ici).
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonthLabel = `${currentYear}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const currentMonthName = MONTH_LABELS[now.getUTCMonth()]
  // On n'affiche pas les mois futurs : année en cours → jusqu'au mois courant inclus ; année passée → 12.
  const monthsToShow = year === currentYear ? now.getUTCMonth() + 1 : 12

  const isCurrentYear = year === currentYear
  const meSeries = stats?.series.find(s => s.key === 'me')
  const countAtCurrentMonth = s => s?.months.find(m => m.month === currentMonthLabel)?.count ?? 0
  const yearTotalOf = s => (s?.months || []).reduce((a, m) => a + (m.count || 0), 0)
  const meMonth = countAtCurrentMonth(meSeries)
  const meYear = yearTotalOf(meSeries)
  const competitorSeries = (stats?.series || []).filter(s => s.key !== 'me')
  const compStats = competitorSeries.map(s => ({ key: s.key, name: s.name || s.key, month: countAtCurrentMonth(s), year: yearTotalOf(s) }))
  const bestYear = compStats.reduce((acc, c) => (!acc || c.year > acc.year ? c : acc), null)

  const rtQuotaEnabled = rtQuota?.enabled !== false
  const atMax = rtQuota?.max_competitors != null && competitors.length >= rtQuota.max_competitors

  // "Ma fiche" toujours en tête (colonne + série), quel que soit l'ordre renvoyé par l'API.
  const orderedSeries = stats
    ? [...stats.series].sort((a, b) => (a.key === 'me' ? -1 : b.key === 'me' ? 1 : 0))
    : []
  const anyIncomplete = orderedSeries.some(s => s.complete_from)

  // clé de série = s.key (place_id ou 'me', toujours unique) — jamais le nom affiché, que deux concurrents
  // peuvent partager (enseignes en franchise, ex. « Guy Hoquet »). Le libellé affiché est porté séparément
  // (line.label) pour la légende/l'infobulle, sans risquer d'écraser les données d'une série homonyme.
  const chartData = stats
    ? stats.series[0]?.months.slice(0, monthsToShow).map((m, i) => {
        const row = { label: MONTH_LABELS[i] }
        stats.series.forEach(s => { row[s.key] = s.months[i]?.count ?? 0 })
        return row
      }) || []
    : []
  const chartLines = stats
    ? stats.series.map((s, i) => ({ key: s.key, label: s.key === 'me' ? 'Ma fiche' : (s.name || s.key), color: LINE_COLORS[i % LINE_COLORS.length] }))
    : []

  return (
    <AppLayout title="Avis — Concurrents">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-text-primary">Concurrents</h1>
          {stats && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-secondary">Année</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="h-9 px-3 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
                {stats.available_years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* ── Statistiques de l'année sélectionnée : total {year} par entité (+ mois en cours) ── */}
        {stats && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-text-secondary">
              Avis reçus en {year}{isCurrentYear ? ` · mois en cours : ${currentMonthName}` : ''}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Ma fiche"
                value={meYear}
                delta={bestYear ? meYear - bestYear.year : undefined}
                deltaPositive={bestYear ? meYear >= bestYear.year : undefined}
                sub={isCurrentYear ? `${meMonth} ce mois-ci` : `sur l'année ${year}`}
              />
              {compStats.map(c => (
                <MetricCard key={c.key} label={c.name} value={c.year}
                  sub={isCurrentYear ? `${c.month} ce mois-ci` : `sur l'année ${year}`} />
              ))}
            </div>
          </section>
        )}

        {/* ── Courbe (juste sous les cartes) ── */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <TrendChart data={chartData} lines={chartLines} yReversed={false} yLabel="Avis reçus" />
        </div>

        {/* ── Tableau mensuel (pleine largeur, colonnes proportionnelles, cellules colorées par classement) ── */}
        {stats && (
          <div className="bg-white border border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-20" />
                {orderedSeries.map(s => <col key={s.key} />)}
              </colgroup>
              <thead>
                <tr className="border-b border-border text-xs font-medium text-text-secondary">
                  <th className="px-4 py-3 text-left">Mois</th>
                  {orderedSeries.map(s => (
                    <th key={s.key} className="px-3 py-3 text-center break-words">{s.key === 'me' ? 'Ma fiche' : (s.name || s.key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MONTH_LABELS.slice(0, monthsToShow).map((label, i) => {
                  const monthKey = orderedSeries[0]?.months[i]?.month
                  const counts = orderedSeries.map(s => s.months[i]?.count ?? 0)
                  const styles = monthCellStyles(counts)
                  return (
                    <tr key={label}>
                      <td className="px-4 py-2.5 font-medium text-text-primary">{label}</td>
                      {orderedSeries.map((s, idx) => {
                        const incomplete = s.complete_from && monthKey && monthKey <= s.complete_from
                        return (
                          <td key={s.key} style={styles[idx] || undefined}
                            className={`px-3 py-2.5 text-center tabular-nums ${s.key === 'me' ? 'font-semibold' : ''} ${incomplete ? 'italic' : ''}`}>
                            {counts[idx]}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: RANK_PALETTE.top1.soft, border: `1px solid ${RANK_PALETTE.top1.solid}` }} /> En tête du mois
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: RANK_PALETTE.mid.soft, border: `1px solid ${RANK_PALETTE.mid.solid}` }} /> Milieu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: RANK_PALETTE.low.soft, border: `1px solid ${RANK_PALETTE.low.solid}` }} /> En retrait
          </span>
          {anyIncomplete && <span>· valeurs en italique = mois potentiellement incomplets (historique pas encore intégralement synchronisé)</span>}
        </div>

        {/* ── Gestion des concurrents (en bas) ── */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Concurrents suivis</h2>
            {rtQuota?.max_competitors != null && (
              <span className="text-xs text-text-tertiary">{competitors.length} / {rtQuota.max_competitors} · liste partagée avec le Positionnement</span>
            )}
          </div>

          {!configId || !rtQuotaEnabled ? (
            <p className="text-sm text-text-secondary">Le suivi de positionnement doit être inclus dans votre plan pour ajouter des concurrents.</p>
          ) : (
            <div>
              {!atMax && (
                <PlaceSearch
                  key={competitors.length}
                  onSelect={place => addCompetitor(place.place_id, place.name)}
                  country={activeBusiness?.country}
                  placeholder="Rechercher un concurrent (fiche Google)"
                />
              )}
              {atMax && <p className="text-xs text-text-tertiary">Limite de votre plan atteinte.</p>}
            </div>
          )}

          {competitors.length > 0 && (
            <ul className="divide-y divide-border">
              {competitors.map(c => {
                const s = stats?.series.find(x => x.key === c.place_id)
                return (
                  <li key={c.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{c.name || c.place_id}</p>
                      <p className="text-xs text-text-tertiary">
                        {s?.avg_rating != null ? `${s.avg_rating}★` : '—'} · {s?.total_reviews_count ?? 0} avis · dernière synchro {fmtDate(s?.last_synced_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {syncingPlaceId === c.place_id && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-accent">
                          <Loader2 size={12} className="animate-spin" /> Synchronisation…
                        </span>
                      )}
                      <button onClick={() => removeCompetitor(c.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-danger hover:bg-red-50 transition-colors"
                        title="Retirer ce concurrent">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {detectedList.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-text-secondary mb-2">Concurrents repérés dans vos scans de positionnement</p>
              <div className="flex flex-wrap gap-2">
                {detectedList.map(d => (
                  <button key={d.place_id} onClick={() => addCompetitor(d.place_id, d.name)} disabled={atMax}
                    className="inline-flex items-center gap-2 text-xs pl-2.5 pr-3 h-8 rounded-full border border-border hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus size={12} className="shrink-0" />
                    <span className="max-w-[200px] truncate">{d.name || d.place_id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
