const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridScanCompetitor = sequelize.define('GeogridScanCompetitor', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  scan_id:      { type: DataTypes.UUID, allowNull: false },
  business_id:  { type: DataTypes.UUID, allowNull: false },
  place_id:     { type: DataTypes.STRING, allowNull: false },
  name:         { type: DataTypes.STRING },
  avg_position: { type: DataTypes.DECIMAL(6, 2) }, // position moyenne (couverture), non-classé/hors profondeur mesurée = 21
  points_top3:  { type: DataTypes.INTEGER, defaultValue: 0 },
  points_top10: { type: DataTypes.INTEGER, defaultValue: 0 },
  points_top20: { type: DataTypes.INTEGER, defaultValue: 0 },
  appearances:  { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'geogrid_scan_competitors',
  underscored: true,
  updatedAt: false,
})

module.exports = GeogridScanCompetitor
