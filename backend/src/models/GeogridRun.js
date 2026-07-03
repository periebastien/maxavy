const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridRun = sequelize.define('GeogridRun', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:    { type: DataTypes.UUID, allowNull: false },
  location_id:    { type: DataTypes.UUID, allowNull: false },
  config_id:      { type: DataTypes.UUID, allowNull: false },
  trigger:        { type: DataTypes.ENUM('manual', 'scheduled'), allowNull: false },
  status:         { type: DataTypes.ENUM('pending', 'running', 'done', 'failed', 'retry_pending'), defaultValue: 'pending' },
  has_failures:   { type: DataTypes.BOOLEAN, defaultValue: false }, // done avec >=1 scan en échec — voir GEOGRID_REFONTE_FR.md §16
  scheduled_for:  { type: DataTypes.DATE },
  started_at:     { type: DataTypes.DATE },
  finished_at:    { type: DataTypes.DATE },
  keywords_total: { type: DataTypes.INTEGER, defaultValue: 0 },
  keywords_done:  { type: DataTypes.INTEGER, defaultValue: 0 },
  attempts:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // reprises de run consommées (Level C)
  next_attempt_at: { type: DataTypes.DATE }, // filet de sécurité run : quand relancer les mots-clés non couverts
  notify_failure: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // hook alerte email G11 (échec définitif)
}, {
  tableName: 'geogrid_runs',
  underscored: true,
  updatedAt: false,
})

module.exports = GeogridRun
