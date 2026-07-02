const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GeogridCompetitor = sequelize.define('GeogridCompetitor', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  config_id:   { type: DataTypes.UUID, allowNull: false },
  place_id:    { type: DataTypes.STRING, allowNull: false },
  name:        { type: DataTypes.STRING },
  active:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'geogrid_competitors',
  underscored: true,
  updatedAt: false,
})

module.exports = GeogridCompetitor
