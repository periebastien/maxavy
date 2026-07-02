const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridPoint = sequelize.define('GeogridPoint', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  scan_id:     { type: DataTypes.UUID, allowNull: false },
  business_id: { type: DataTypes.UUID, allowNull: false },
  row:         { type: DataTypes.INTEGER, allowNull: false },
  col:         { type: DataTypes.INTEGER, allowNull: false },
  quadrant:    { type: DataTypes.ENUM('NW', 'NE', 'SW', 'SE', 'C'), allowNull: false },
  lat:         { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  lng:         { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  rank:              { type: DataTypes.INTEGER }, // null = non classé (hors Top 20)
  competitors:       { type: DataTypes.JSONB, defaultValue: [] },
  provider_task_id:  { type: DataTypes.STRING }, // id de la tâche chez le fournisseur (DataForSEO)
  fetched_at:        { type: DataTypes.DATE }, // null = résultat pas encore récupéré (distinct de rank=null qui veut dire "non classé")
}, {
  tableName: 'geogrid_points',
  underscored: true,
  updatedAt: false, // pas de colonne updated_at en base (points écrits une seule fois) — cf bug Review
})

module.exports = GeogridPoint
