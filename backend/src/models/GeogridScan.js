const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridScan = sequelize.define('GeogridScan', {
  id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:           { type: DataTypes.UUID, allowNull: false },
  location_id:           { type: DataTypes.UUID, allowNull: false },
  keyword_id:            { type: DataTypes.UUID, allowNull: false },
  keyword:               { type: DataTypes.STRING, allowNull: false }, // snapshot au moment du scan
  grid_size:             { type: DataTypes.INTEGER, allowNull: false },
  grid_spacing_m:        { type: DataTypes.INTEGER, allowNull: false },
  center_lat:            { type: DataTypes.DECIMAL(10, 7) },
  center_lng:            { type: DataTypes.DECIMAL(10, 7) },
  status:                { type: DataTypes.ENUM('pending', 'running', 'done', 'failed'), defaultValue: 'pending' },
  provider:               { type: DataTypes.STRING },
  arp:                    { type: DataTypes.DECIMAL(6, 2) },
  atrp:                   { type: DataTypes.DECIMAL(6, 2) },
  solv:                   { type: DataTypes.DECIMAL(5, 2) },
  rating_snapshot:        { type: DataTypes.DECIMAL(2, 1) },
  review_count_snapshot:  { type: DataTypes.INTEGER },
  points_total:           { type: DataTypes.INTEGER },
  points_ranked:          { type: DataTypes.INTEGER },
  credits_used:           { type: DataTypes.DECIMAL(10, 4) }, // coût fournisseur en $ (fractionnaire)
  error_message:          { type: DataTypes.TEXT },
  scanned_at:             { type: DataTypes.DATE },
}, {
  tableName: 'geogrid_scans',
  underscored: true,
})

module.exports = GeogridScan
