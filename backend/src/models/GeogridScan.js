const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridScan = sequelize.define('GeogridScan', {
  id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:           { type: DataTypes.UUID, allowNull: false },
  location_id:           { type: DataTypes.UUID, allowNull: false },
  keyword_id:            { type: DataTypes.UUID, allowNull: false },
  run_id:                { type: DataTypes.UUID }, // rapport ayant déclenché ce scan (refonte G5+) — null = scan "legacy" (G1→G4) ou hors run
  keyword:               { type: DataTypes.STRING, allowNull: false }, // snapshot au moment du scan
  grid_size:             { type: DataTypes.INTEGER, allowNull: false },
  grid_spacing_m:        { type: DataTypes.INTEGER, allowNull: false },
  center_lat:            { type: DataTypes.DECIMAL(10, 7) },
  center_lng:            { type: DataTypes.DECIMAL(10, 7) },
  status:                { type: DataTypes.ENUM('pending', 'running', 'done', 'failed', 'retry_pending'), defaultValue: 'pending' },
  provider:               { type: DataTypes.STRING },
  arp:                    { type: DataTypes.DECIMAL(6, 2) },
  atrp:                   { type: DataTypes.DECIMAL(6, 2) },
  solv:                   { type: DataTypes.DECIMAL(5, 2) },
  rating_snapshot:        { type: DataTypes.DECIMAL(2, 1) },
  review_count_snapshot:  { type: DataTypes.INTEGER },
  points_total:           { type: DataTypes.INTEGER },
  points_ranked:          { type: DataTypes.INTEGER },
  points_top3:            { type: DataTypes.INTEGER }, // figé au finalize (refonte G5+), comme arp/atrp/solv
  points_top10:           { type: DataTypes.INTEGER },
  points_top20:           { type: DataTypes.INTEGER },
  credits_used:           { type: DataTypes.DECIMAL(10, 4) }, // coût fournisseur en $ (fractionnaire)
  error_message:          { type: DataTypes.TEXT },
  scanned_at:             { type: DataTypes.DATE },
  attempts:               { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // reprises consommées (résilience cron)
  next_attempt_at:        { type: DataTypes.DATE }, // quand retenter (null = aucune reprise programmée)
  retry_reason:           { type: DataTypes.STRING }, // 'transport' (re-submit sûr) | 'partial' (re-poll gratuit)
  shape:                  { type: DataTypes.STRING }, // snapshot de la forme de grille au moment du scan ; null = scan antérieur à la colonne
}, {
  tableName: 'geogrid_scans',
  underscored: true,
})

module.exports = GeogridScan
