const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// 1 ligne = 1 concurrent ACTUELLEMENT suivi (module avis) pour une localisation. Réconcilié par le cron
// depuis geogrid_competitors (liste partagée avec le positionnement — AVIS_CONCURRENTS_FR.md §2.2/§9) :
// jamais écrit depuis le module rank-tracking lui-même.
const ReviewCompetitorTracking = sequelize.define('ReviewCompetitorTracking', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:         { type: DataTypes.UUID, allowNull: false },
  location_id:         { type: DataTypes.UUID, allowNull: false },
  place_id:            { type: DataTypes.STRING, allowNull: false },
  name:                { type: DataTypes.STRING },
  total_reviews_count: { type: DataTypes.INTEGER },
  avg_rating:          { type: DataTypes.FLOAT },
  last_synced_at:      { type: DataTypes.DATE },
  next_sync_at:        { type: DataTypes.DATE }, // NULL = jamais synchronisé → dû immédiatement (backfill)
  backfilled_at:       { type: DataTypes.DATE }, // NULL = backfill initial pas encore fait
}, {
  tableName: 'review_competitor_tracking',
  underscored: true,
  updatedAt: false,
})

module.exports = ReviewCompetitorTracking
