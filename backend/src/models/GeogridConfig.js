const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridConfig = sequelize.define('GeogridConfig', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:        { type: DataTypes.UUID, allowNull: false },
  location_id:        { type: DataTypes.UUID, allowNull: false }, // unique — 1 config par localisation
  center_lat:         { type: DataTypes.DECIMAL(10, 7) }, // null = centre sur la fiche (location.lat/lng)
  center_lng:         { type: DataTypes.DECIMAL(10, 7) },
  shape:              { type: DataTypes.ENUM('square', 'circle'), defaultValue: 'square' },
  grid_size:          { type: DataTypes.INTEGER, defaultValue: 7 },
  grid_spacing_m:     { type: DataTypes.INTEGER, defaultValue: 500 },
  frequency:          { type: DataTypes.ENUM('monthly', 'weekly', 'daily'), defaultValue: 'weekly' },
  run_hour:           { type: DataTypes.INTEGER, defaultValue: 4 }, // heure locale (0-23)
  run_day_of_week:    { type: DataTypes.INTEGER }, // 0 (dimanche) - 6 (samedi), pour frequency=weekly
  run_day_of_month:   { type: DataTypes.INTEGER }, // 1-31, pour frequency=monthly (clamp fin de mois côté appli)
  timezone:           { type: DataTypes.STRING }, // défaut = business.timezone si null
  next_run_at:        { type: DataTypes.DATE }, // calculé côté appli (G6), pilote le cron
  active:             { type: DataTypes.BOOLEAN, defaultValue: true },
  email_enabled:      { type: DataTypes.BOOLEAN, defaultValue: false },
  email_recipients:   { type: DataTypes.JSONB, defaultValue: [] }, // chiffré applicativement (G11, données perso)
  email_cadence:      { type: DataTypes.ENUM('per_report', 'weekly', 'monthly') },
  email_day_of_week:  { type: DataTypes.INTEGER },
  email_day_of_month: { type: DataTypes.INTEGER },
  email_hour:         { type: DataTypes.INTEGER },
}, {
  tableName: 'geogrid_configs',
  underscored: true,
})

module.exports = GeogridConfig
