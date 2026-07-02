// Agrégation temporelle des courbes de positionnement — GEOGRID_REFONTE_FR.md §4.2.
// Deux réglages indépendants : granularité (jour/semaine/mois) et mode (moyenne de la période /
// meilleure position). Bucketing en semaine lundi-dimanche (convention FR). Pas de dépendance de dates
// ajoutée côté front : arithmétique Date native suffit, à condition de rester en composants LOCAUX
// (getFullYear/getMonth/getDate) de bout en bout — jamais toISOString() pour la clé, qui repasse par
// UTC et peut faire glisser le jour d'un cran selon le fuseau du navigateur.

export const RANGE_PRESETS = [
  { value: '30d', label: '30 derniers jours', days: 30 },
  { value: '90d', label: '90 derniers jours', days: 90 },
  { value: '6m', label: '6 derniers mois', days: 182 },
  { value: '1y', label: '12 derniers mois', days: 365 },
  { value: 'all', label: "Tout l'historique", days: null },
]

export const GRANULARITIES = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
]

export const AGG_MODES = [
  { value: 'average', label: 'Moyenne de la période' },
  { value: 'best', label: 'Meilleure position' },
]

function pad2(n) { return String(n).padStart(2, '0') }
function round2(n) { return Math.round(n * 100) / 100 }

function bucketOf(date, granularity) {
  const d = new Date(date)
  if (granularity === 'day') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    return { key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`, start }
  }
  if (granularity === 'week') {
    const dow = d.getDay() // 0=dimanche..6=samedi
    const diffToMonday = (dow + 6) % 7 // lundi=0
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday)
    return { key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`, start }
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  return { key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}`, start }
}

function formatBucketLabel(start, granularity) {
  if (granularity === 'day') return start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  if (granularity === 'week') return `Sem. du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  return start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function filterByRange(points, rangePreset) {
  const preset = RANGE_PRESETS.find(p => p.value === rangePreset) || RANGE_PRESETS[1]
  if (preset.days == null) return points
  const cutoff = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000)
  return points.filter(p => new Date(p.date) >= cutoff)
}

// points : [{ date, value }]. mode 'best' = valeur MINIMALE du bucket (ATRP est un rang, plus bas =
// mieux — cf. GEOGRID_REFONTE_FR.md §4.2) ; 'average' = moyenne. Retour trié chronologiquement (les clés
// sont formatées pour que le tri lexicographique corresponde au tri chronologique).
export function bucketize(points, granularity, mode) {
  const buckets = new Map()
  for (const p of points) {
    if (p.value == null) continue
    const { key, start } = bucketOf(p.date, granularity)
    if (!buckets.has(key)) buckets.set(key, { start, values: [] })
    buckets.get(key).values.push(p.value)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { start, values }]) => ({
      key,
      label: formatBucketLabel(start, granularity),
      value: mode === 'best' ? Math.min(...values) : round2(values.reduce((a, b) => a + b, 0) / values.length),
    }))
}

// Fusionne plusieurs séries déjà bucketées (1 par mot-clé) en lignes uniques pour Recharts, alignées par
// clé de bucket. Un bucket absent pour un mot-clé reste `null` — Recharts saute juste ce segment de ligne.
export function mergeSeriesForChart(seriesByLabel) {
  const bucketLabels = new Map()
  Object.values(seriesByLabel).forEach(series => {
    series.forEach(pt => { if (!bucketLabels.has(pt.key)) bucketLabels.set(pt.key, pt.label) })
  })
  const sortedKeys = [...bucketLabels.keys()].sort()
  return sortedKeys.map(key => {
    const row = { key, label: bucketLabels.get(key) }
    for (const [seriesLabel, series] of Object.entries(seriesByLabel)) {
      const pt = series.find(p => p.key === key)
      row[seriesLabel] = pt ? pt.value : null
    }
    return row
  })
}
