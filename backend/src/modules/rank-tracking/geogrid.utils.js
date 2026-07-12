// Génère les points GPS d'une grille centrée sur (centerLat, centerLng), espacés de spacingM mètres.
// N doit être impair (un point tombe pile sur le centre). Les DEUX formes renvoient exactement N² points
// (décision produit — « même nombre de points en cercle et en carré », GEOGRID_REFONTE_FR.md §6) :
//   - 'square' : la grille carrée N×N complète (rangs/colonnes de -half à +half).
//   - 'circle' : une VRAIE GRILLE POLAIRE — un point central + R = (N-1)/2 anneaux concentriques.
//     L'anneau k est à distance exacte k×spacingM du centre et porte 8k points répartis uniformément
//     en angle (premier point plein nord, puis sens horaire). Total = 1 + Σ 8k = N² (ex. 7×7 → 49).
//     L'espacement d'arc entre points d'un même anneau est constant (≈ 0,79×spacing pour les
//     anneaux extérieurs) plutôt que d'être un sous-ensemble d'une maille carrée. Encodage dans les
//     champs existants : row = numéro d'anneau k (0 pour le centre), col = index j dans l'anneau
//     (0 pour le centre) — ce ne sont plus des coordonnées cartésiennes pour cette forme.

const METERS_PER_DEGREE_LAT = 111320
const SHAPES = ['square', 'circle']
const SIGN_EPSILON = 1e-9

function quadrantOf(row, col) {
  if (row === 0 && col === 0) return 'C'
  if (row >= 0 && col >= 0) return 'NE'
  if (row >= 0 && col < 0) return 'NW'
  if (row < 0 && col >= 0) return 'SE'
  return 'SW'
}

// Quadrant à partir des offsets géométriques signés (nord/est), pour la grille polaire.
// Arrondi à SIGN_EPSILON pour neutraliser les quasi-zéros flottants (ex. cos(π/2)).
function quadrantOfOffsets(dNorth, dEast) {
  if (Math.abs(dNorth) < SIGN_EPSILON && Math.abs(dEast) < SIGN_EPSILON) return 'C'
  const n = Math.abs(dNorth) < SIGN_EPSILON ? 0 : dNorth
  const e = Math.abs(dEast) < SIGN_EPSILON ? 0 : dEast
  if (n >= 0 && e >= 0) return 'NE'
  if (n >= 0 && e < 0) return 'NW'
  if (n < 0 && e >= 0) return 'SE'
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
    // Grille polaire : centre + anneaux k = 1..R, chacun à distance k×spacingM, avec 8k points
    // uniformément répartis en angle (premier point plein nord, sens horaire). row = anneau k,
    // col = index j dans l'anneau. Ordre de sortie déterministe : centre, puis anneau 1 → R.
    const R = (gridSize - 1) / 2
    const points = [
      {
        row: 0,
        col: 0,
        quadrant: 'C',
        lat: Math.round(centerLat * 1e7) / 1e7,
        lng: Math.round(centerLng * 1e7) / 1e7,
      },
    ]

    for (let k = 1; k <= R; k++) {
      const pointsInRing = 8 * k
      for (let j = 0; j < pointsInRing; j++) {
        const theta = (j * 2 * Math.PI) / pointsInRing
        let dNorth = k * spacingM * Math.cos(theta)
        let dEast = k * spacingM * Math.sin(theta)
        if (Math.abs(dNorth) < SIGN_EPSILON) dNorth = 0
        if (Math.abs(dEast) < SIGN_EPSILON) dEast = 0

        points.push({
          row: k,
          col: j,
          quadrant: quadrantOfOffsets(dNorth, dEast),
          lat: Math.round((centerLat + dNorth / METERS_PER_DEGREE_LAT) * 1e7) / 1e7,
          lng: Math.round((centerLng + dEast / metersPerDegreeLng) * 1e7) / 1e7,
        })
      }
    }

    return points
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
