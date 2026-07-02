const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridRun = sequelize.define('GeogridRun', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:    { type: DataTypes.UUID, allowNull: false },
  location_id:    { type: DataTypes.UUID, allowNull: false },
  config_id:      { type: DataTypes.UUID, allowNull: false },
  trigger:        { type: DataTypes.ENUM('manual', 'scheduled'), allowNull: false },
  status:         { type: DataTypes.ENUM('pending', 'running', 'done', 'failed'), defaultValue: 'pending' },
  has_failures:   { type: DataTypes.BOOLEAN, defaultValue: false }, // done avec >=1 scan en échec — voir GEOGRID_REFONTE_FR.md §16
  scheduled_for:  { type: DataTypes.DATE },
  started_at:     { type: DataTypes.DATE },
  finished_at:    { type: DataTypes.DATE },
  keywords_total: { type: DataTypes.INTEGER, defaultValue: 0 },
  keywords_done:  { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'geogrid_runs',
  underscored: true,
  updatedAt: false,
})

module.exports = GeogridRun
