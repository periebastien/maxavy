// Continuité "zone commune" des courbes de tendance (S1, GEOGRID_REFONTE_FR.md). Quand la grille change
// de taille/espacement/centre/forme entre deux scans, les métriques agrégées (ATRP/ARP/SOLV) sautent
// artificiellement car elles ne portent pas sur le même nombre de points. On harmonise en ne comparant
// que les points géographiquement communs à TOUS les scans de la série (intersection exacte des
// coordonnées, arrondies à 1e-7 — une grille plus petite de même centre/espacement est un sous-ensemble
// exact de la plus grande, car générée par la même formule).
//
// Partagé entre scan.service.js (getTrend, fiche) et competitor.service.js (trend, concurrents).

const NOT_RANKED = 21 // même convention que l'ATRP (scan.service.js)
const MIN_COMMON_POINTS = 9 // en-dessous, la comparaison n'a plus de sens (rupture réelle de config)

function round2(n) { return Math.round(n * 100) / 100 }

// Signature géométrique d'un scan : deux scans avec la même signature ont été générés par la même
// formule de grille (même formule de génération => mêmes coordonnées au bit près après arrondi 1e-7).
function scanGeometrySignature(scan) {
  const lat = scan.center_lat != null ? Number(scan.center_lat).toFixed(7) : ''
  const lng = scan.center_lng != null ? Number(scan.center_lng).toFixed(7) : ''
  return `${scan.grid_size}|${scan.grid_spacing_m}|${lat}|${lng}|${scan.shape || ''}`
}

function pointGeometryKey(lat, lng) {
  return `${Number(lat).toFixed(7)}:${Number(lng).toFixed(7)}`
}

// true si les scans fournis présentent au moins 2 signatures géométriques distinctes (sinon, aucune
// harmonisation n'est nécessaire — cas nominal, coût nul).
function hasMixedGeometries(scans) {
  const signatures = new Set(scans.map(scanGeometrySignature))
  return signatures.size >= 2
}

// Calcule l'intersection des clés géométriques (lat:lng arrondis) entre les points de tous les scans
// fournis. `pointsByScanId` : Map<scanId, Array<{ lat, lng, ... }>>. Retourne un Set de clés communes
// à TOUS les scans (vide si un seul scan n'a aucun point).
function intersectPointKeys(pointsByScanId) {
  const keySets = [...pointsByScanId.values()].map(points => new Set(points.map(p => pointGeometryKey(p.lat, p.lng))))
  if (!keySets.length) return new Set()
  let common = keySets[0]
  for (let i = 1; i < keySets.length; i++) {
    const next = keySets[i]
    common = new Set([...common].filter(k => next.has(k)))
    if (!common.size) break
  }
  return common
}

// Regroupe des lignes { scan_id, lat, lng, ... } par scan_id.
function groupPointsByScan(points) {
  const map = new Map()
  for (const p of points) {
    if (!map.has(p.scan_id)) map.set(p.scan_id, [])
    map.get(p.scan_id).push(p)
  }
  return map
}

// Agrégats ATRP/ARP/SOLV comparables sur le sous-ensemble de points d'un scan appartenant à
// l'intersection commune (commonKeys).
function computeComparableAggregates(scanPoints, commonKeys) {
  const subset = scanPoints.filter(p => commonKeys.has(pointGeometryKey(p.lat, p.lng)))
  if (subset.length < MIN_COMMON_POINTS) return null

  const ranked = subset.filter(p => p.rank != null)
  const atrp_comparable = round2(subset.reduce((sum, p) => sum + (p.rank ?? NOT_RANKED), 0) / subset.length)
  const arp_comparable = ranked.length ? round2(ranked.reduce((sum, p) => sum + p.rank, 0) / ranked.length) : null
  const solv_comparable = round2((subset.filter(p => p.rank != null && p.rank <= 3).length / subset.length) * 100)

  return { atrp_comparable, arp_comparable, solv_comparable, points_comparable: subset.length }
}

// Position moyenne comparable d'un concurrent sur le sous-ensemble commun d'un scan (même convention que
// aggregateCompetitorOnPoints : rank imputé à NOT_RANKED si le concurrent n'apparaît pas dans le point).
function computeComparableCompetitorAvg(scanPoints, commonKeys, placeId) {
  const subset = scanPoints.filter(p => commonKeys.has(pointGeometryKey(p.lat, p.lng)))
  if (subset.length < MIN_COMMON_POINTS) return null
  const sum = subset.reduce((acc, p) => {
    const found = (p.competitors || []).find(c => c.place_id === placeId)
    return acc + (found ? found.rank : NOT_RANKED)
  }, 0)
  return round2(sum / subset.length)
}

module.exports = {
  NOT_RANKED,
  MIN_COMMON_POINTS,
  round2,
  scanGeometrySignature,
  pointGeometryKey,
  hasMixedGeometries,
  intersectPointKeys,
  groupPointsByScan,
  computeComparableAggregates,
  computeComparableCompetitorAvg,
}
