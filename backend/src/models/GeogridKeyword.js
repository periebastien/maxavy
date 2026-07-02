const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridKeyword = sequelize.define('GeogridKeyword', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:    { type: DataTypes.UUID, allowNull: false },
  location_id:    { type: DataTypes.UUID, allowNull: false },
  config_id:      { type: DataTypes.UUID }, // rattachement à la config partagée de la localisation (refonte G5+) — null = pas encore migré/rattaché
  keyword:        { type: DataTypes.STRING, allowNull: false },
  grid_size:      { type: DataTypes.INTEGER, defaultValue: 7 },
  grid_spacing_m: { type: DataTypes.INTEGER, defaultValue: 500 },
  frequency:      { type: DataTypes.ENUM('weekly', 'daily'), defaultValue: 'weekly' },
  active:         { type: DataTypes.BOOLEAN, defaultValue: true },
  last_scanned_at: { type: DataTypes.DATE }, // dernier scan lancé — pilote la détection « dû » du cron
}, {
  tableName: 'geogrid_keywords',
  underscored: true,
})

module.exports = GeogridKeyword
