const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// Une tâche de synchro d'avis DataForSEO pour UNE localisation (task_post → tasks_ready → task_get).
// kind: 'backfill' (1er passage, profondeur élevée) ou 'incremental' (avis récents, sort_by=newest).
const ReviewSyncJob = sequelize.define('ReviewSyncJob', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:      { type: DataTypes.UUID, allowNull: false },
  location_id:      { type: DataTypes.UUID, allowNull: false },
  competitor_place_id: { type: DataTypes.STRING }, // NULL = job pour la fiche du business elle-même
  provider:         { type: DataTypes.STRING, defaultValue: 'dataforseo' },
  provider_task_id: { type: DataTypes.STRING },
  kind:             { type: DataTypes.ENUM('backfill', 'incremental'), allowNull: false },
  status:           { type: DataTypes.ENUM('pending', 'running', 'done', 'failed'), defaultValue: 'pending' },
  depth:            { type: DataTypes.INTEGER, allowNull: false },
  sort_by:          { type: DataTypes.STRING, defaultValue: 'newest' },
  reviews_found:    { type: DataTypes.INTEGER, defaultValue: 0 },
  reviews_upserted: { type: DataTypes.INTEGER, defaultValue: 0 },
  cost:             { type: DataTypes.FLOAT, defaultValue: 0 },
  error_message:    { type: DataTypes.TEXT },
  started_at:       { type: DataTypes.DATE },
  finished_at:      { type: DataTypes.DATE },
}, {
  tableName: 'review_sync_jobs',
  underscored: true,
  updatedAt: false,
})

module.exports = ReviewSyncJob
