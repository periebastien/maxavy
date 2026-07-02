// Génère les points GPS d'une grille centrée sur (centerLat, centerLng), espacés de spacingM mètres.
// N doit être impair (un point tombe pile sur le centre). Les DEUX formes renvoient exactement N² points
// (décision produit — « même nombre de points en cercle et en carré », GEOGRID_REFONTE_FR.md §6) :
//   - 'square' : la grille carrée N×N complète (rangs/colonnes de -half à +half).
//   - 'circle' : les N² points les plus proches du centre → remplit un disque de façon optimale (les
//     points forment un cercle, pas un carré). Pour nos tailles (N impair ≤ 15) les N² plus proches
//     tombent pile sur des « couronnes » complètes → disque symétrique (7×7 → disque de rayon 4 = 49 pts).

const METERS_PER_DEGREE_LAT = 111320
const SHAPES = ['square', 'circle']

function quadrantOf(row, col) {
  if (row === 0 && col === 0) return 'C'
  if (row >= 0 && col >= 0) return 'NE'
  if (row >= 0 && col < 0) return 'NW'
  if (row < 0 && col >= 0) return 'SE'
  return 'SW'
}

function buildGrid(centerLat, centerLng, gridSize, spacingM, shape = 'square') {
  if (!Number.isInteger(gridSize) || gridSize < 3 || gridSize % 2 === 0) {
    throw { status: 400, message: 'La taille de la grille doit être un nombre impair ≥ 3' }
  }
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    throw { status: 400, message: 'Coordonnées du centre invalides' }
  }
  if (!SHAPES.includes(shape)) {
    throw { status: 400, message: "Forme de grille invalide (attendu 'square' ou 'circle')" }
  }

  const half = (gridSize - 1) / 2
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180)

  const toPoint = (row, col) => ({
    row,
    col,
    quadrant: quadrantOf(row, col),
    lat: Math.round((centerLat + (row * spacingM) / METERS_PER_DEGREE_LAT) * 1e7) / 1e7,
    lng: Math.round((centerLng + (col * spacingM) / metersPerDegreeLng) * 1e7) / 1e7,
  })

  if (shape === 'circle') {
    // Les N² points les plus proches du centre (disque optimal). Plage de candidats généreuse : le
    // disque de N² points a un rayon < N. Tri déterministe : distance croissante puis balayage
    // nord→sud / ouest→est pour départager d'éventuelles égalités.
    const target = gridSize * gridSize
    const candidates = []
    for (let row = gridSize; row >= -gridSize; row--) {
      for (let col = -gridSize; col <= gridSize; col++) {
        candidates.push({ row, col, d2: row * row + col * col })
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2 || b.row - a.row || a.col - b.col)
    return candidates.slice(0, target).map(c => toPoint(c.row, c.col))
  }

  const points = []
  for (let row = half; row >= -half; row--) {
    for (let col = -half; col <= half; col++) {
      points.push(toPoint(row, col))
    }
  }
  return points
}

module.exports = { buildGrid }
