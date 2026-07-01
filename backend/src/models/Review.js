const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Review = sequelize.define('Review', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  location_id:      { type: DataTypes.UUID },
  business_id:      { type: DataTypes.UUID, allowNull: false },
  platform:         { type: DataTypes.STRING, defaultValue: 'google' },
  external_id:      { type: DataTypes.STRING },
  author_name:      { type: DataTypes.STRING },
  rating:           { type: DataTypes.INTEGER },
  text:             { type: DataTypes.TEXT },
  sentiment:        { type: DataTypes.STRING },
  published_at:     { type: DataTypes.DATE },
  replied:          { type: DataTypes.BOOLEAN, defaultValue: false },
  reply_text:       { type: DataTypes.TEXT },
  reply_time:       { type: DataTypes.DATE },
}, { tableName: 'reviews', underscored: true, updatedAt: false })

module.exports = Review
