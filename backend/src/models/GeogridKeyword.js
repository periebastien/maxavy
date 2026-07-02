const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridKeyword = sequelize.define('GeogridKeyword', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  location_id: { type: DataTypes.UUID, allowNull: false },
  config_id:   { type: DataTypes.UUID }, // config partagée de la localisation (grille/planning) — refonte G6, auto-provisionnée si absente
  keyword:     { type: DataTypes.STRING, allowNull: false },
  active:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'geogrid_keywords',
  underscored: true,
})

module.exports = GeogridKeyword
