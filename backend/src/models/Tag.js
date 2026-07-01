const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Tag = sequelize.define('Tag', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  name:        { type: DataTypes.STRING, allowNull: false },
  color:       { type: DataTypes.STRING },
}, { tableName: 'tags', underscored: true })

module.exports = Tag
