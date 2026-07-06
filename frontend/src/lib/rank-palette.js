// Charte graphique partagée des rangs/positions (data-viz) — SOURCE UNIQUE réutilisée par la heatmap de
// positionnement (Google Maps, via lib/geogrid) ET le comparatif d'avis (tableau mensuel). Un rang bas =
// meilleur (rang 1 = tête). Les hex sont nécessaires pour les marqueurs Google Maps ; ils s'alignent sur
// les tokens du thème (success/score/danger). `solid` = pastille/trait pleins ; `soft`/`text` = fond doux
// + texte lisible pour colorer des surfaces (cellules de tableau).

export const RANK_PALETTE = {
  top1:    { solid: '#0B7A57', soft: '#D6F0E6', text: '#0A5C42' }, // #1 (tête) — vert foncé
  top3:    { solid: '#1D9E75', soft: '#E7F5EF', text: '#0F6B4E' }, // Top 3 (2-3) — vert
  mid:     { solid: '#E8833B', soft: '#FBEDDF', text: '#92520F' }, // 4 à 10 — orange
  low:     { solid: '#E24B4A', soft: '#FCE6E5', text: '#932523' }, // 11 à 20 — rouge
  none:    { solid: '#7F1D1D', soft: '#F3DEDE', text: '#7F1D1D' }, // hors classement — rouge très foncé
  neutral: { solid: '#9B9BA8', soft: 'transparent', text: '#6B6B78' }, // pas de donnée
}

// Bucket d'un rang (1 = meilleur ; null = hors classement).
export function rankBucket(rank) {
  if (rank == null) return 'none'
  if (rank <= 1) return 'top1'
  if (rank <= 3) return 'top3'
  if (rank <= 10) return 'mid'
  if (rank <= 20) return 'low'
  return 'none'
}

// Couleur pleine d'un rang — utilisée par les marqueurs de la heatmap.
export function rankColor(rank) {
  return RANK_PALETTE[rankBucket(rank)].solid
}

// Étiquette d'un marqueur de rang.
export function rankLabel(rank) {
  return rank == null ? '·' : String(rank)
}

// Style de surface (fond doux + texte) pour un rang donné — cellules de tableau. null → aucune couleur.
export function rankSurface(rank) {
  if (rank == null) return null
  const b = RANK_PALETTE[rankBucket(rank)]
  return { backgroundColor: b.soft, color: b.text }
}

// Légende affichée sous la heatmap de positionnement.
export const RANK_LEGEND = [
  { color: RANK_PALETTE.top3.solid, label: 'Top 3' },
  { color: RANK_PALETTE.mid.solid,  label: '4 à 10' },
  { color: RANK_PALETTE.low.solid,  label: '11 à 20' },
  { color: RANK_PALETTE.none.solid, label: 'Non classé' },
]
