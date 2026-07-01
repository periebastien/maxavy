const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Widget = sequelize.define('Widget', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  location_id: { type: DataTypes.UUID, allowNull: true },
  tag_id:      { type: DataTypes.UUID, allowNull: true },
  name:        { type: DataTypes.STRING, allowNull: false },
  type:        { type: DataTypes.ENUM('carousel', 'badge'), defaultValue: 'carousel' },
  config:      { type: DataTypes.JSONB, defaultValue: {} },
  embed_code:  { type: DataTypes.TEXT },
}, { tableName: 'widgets', underscored: true })

module.exports = Widget
