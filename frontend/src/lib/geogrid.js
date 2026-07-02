// Couleurs de la heatmap de positionnement (data-viz — hex nécessaires pour les marqueurs Google Maps,
// alignées sur les tokens du thème : success/score/danger). Buckets standard du geogrid.
export function rankColor(rank) {
  if (rank == null) return '#7F1D1D' // non classé (hors Top 20) — rouge très foncé
  if (rank <= 3) return '#1D9E75'    // Top 3 (Local Pack) — vert
  if (rank <= 10) return '#E8833B'   // 4-10 — orange
  return '#E24B4A'                    // 11-20 — rouge
}

export function rankLabel(rank) {
  return rank == null ? '·' : String(rank)
}

// Légende affichée sous la carte.
export const RANK_LEGEND = [
  { color: '#1D9E75', label: 'Top 3' },
  { color: '#E8833B', label: '4 à 10' },
  { color: '#E24B4A', label: '11 à 20' },
  { color: '#7F1D1D', label: 'Non classé' },
]
