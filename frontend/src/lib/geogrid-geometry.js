// Détection des ruptures de géométrie de grille (changement de taille/espacement/centre/forme) dans un
// historique de scans — sert aux marqueurs de rupture sur les courbes (GeogridTrendChart) et à la
// protection de la flèche d'évolution (GeogridSuiviPage). Un scan sans `shape` (vieux scan, colonne
// absente avant migration) n'est PAS considéré en rupture face à un scan avec `shape` si le reste de la
// géométrie est identique — cf. contrat backend, shape nullable pour les vieux scans.

function geometrySignature(scan) {
  return `${scan.grid_size}|${scan.grid_spacing_m}|${scan.center_lat}|${scan.center_lng}`
}

// true si les deux scans ont une géométrie différente (hors tolérance shape null → valeur).
export function isGeometryBreak(prev, next) {
  if (!prev || !next) return false
  if (geometrySignature(prev) !== geometrySignature(next)) return true
  if (prev.shape != null && next.shape != null && prev.shape !== next.shape) return true
  return false
}

// Label court décrivant ce qui a changé entre deux scans, priorisé : taille > espacement > centre > forme.
function breakLabel(prev, next) {
  if (prev.grid_size !== next.grid_size) return `Grille ${prev.grid_size}×${prev.grid_size} → ${next.grid_size}×${next.grid_size}`
  if (prev.grid_spacing_m !== next.grid_spacing_m) return `Espacement ${prev.grid_spacing_m} m → ${next.grid_spacing_m} m`
  if (prev.center_lat !== next.center_lat || prev.center_lng !== next.center_lng) return 'Centre déplacé'
  if (prev.shape != null && next.shape != null && prev.shape !== next.shape) return 'Forme modifiée'
  return 'Grille modifiée'
}

// scans : liste de { scanned_at, grid_size, grid_spacing_m, center_lat, center_lng, shape } — pas
// nécessairement triée. Retourne [{ key, label }] (key = bucketKeyOf(scanned_at, granularity) du premier
// scan de la nouvelle géométrie), une entrée par rupture réelle détectée.
export function detectGeometryBreaks(scans, granularity, bucketKeyOf) {
  const sorted = [...scans].filter(s => s.scanned_at).sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at))
  const markers = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const next = sorted[i]
    if (isGeometryBreak(prev, next)) {
      markers.push({ key: bucketKeyOf(next.scanned_at, granularity), label: breakLabel(prev, next) })
    }
  }
  return markers
}
