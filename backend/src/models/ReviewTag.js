const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ReviewTag = sequelize.define('ReviewTag', {
  review_id: { type: DataTypes.UUID, primaryKey: true },
  tag_id:    { type: DataTypes.UUID, primaryKey: true },
}, { tableName: 'review_tags', underscored: true, timestamps: false })

module.exports = ReviewTag
