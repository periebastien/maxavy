const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// Retour privé (note ≤ 3) déposé sur la page de collecte publique.
const PrivateFeedback = sequelize.define('PrivateFeedback', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:  { type: DataTypes.UUID, allowNull: false },
  location_id:  { type: DataTypes.UUID },
  rating:       { type: DataTypes.INTEGER, allowNull: false },
  comment:      { type: DataTypes.TEXT },
  author_name:  { type: DataTypes.STRING },
  author_email: { type: DataTypes.STRING },
}, {
  tableName: 'private_feedbacks',
  underscored: true,
  updatedAt: false, // table avec created_at seul (cf. migration)
})

module.exports = PrivateFeedback
