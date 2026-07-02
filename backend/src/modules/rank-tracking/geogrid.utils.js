// Génère une grille carrée N×N de points GPS centrée sur (centerLat, centerLng),
// espacés de spacingM mètres. N doit être impair (un point tombe pile sur le centre).
// Voir GEOGRID_DESIGN_FR.md §2.

const METERS_PER_DEGREE_LAT = 111320

function quadrantOf(row, col) {
  if (row === 0 && col === 0) return 'C'
  if (row >= 0 && col >= 0) return 'NE'
  if (row >= 0 && col < 0) return 'NW'
  if (row < 0 && col >= 0) return 'SE'
  return 'SW'
}

function buildGrid(centerLat, centerLng, gridSize, spacingM) {
  if (!Number.isInteger(gridSize) || gridSize < 3 || gridSize % 2 === 0) {
    throw { status: 400, message: 'La taille de la grille doit être un nombre impair ≥ 3' }
  }
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    throw { status: 400, message: 'Coordonnées du centre invalides' }
  }

  const half = (gridSize - 1) / 2
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180)

  const points = []
  for (let row = half; row >= -half; row--) {
    for (let col = -half; col <= half; col++) {
      const lat = centerLat + (row * spacingM) / METERS_PER_DEGREE_LAT
      const lng = centerLng + (col * spacingM) / metersPerDegreeLng
      points.push({
        row,
        col,
        quadrant: quadrantOf(row, col),
        lat: Math.round(lat * 1e7) / 1e7,
        lng: Math.round(lng * 1e7) / 1e7,
      })
    }
  }
  return points
}

module.exports = { buildGrid }
