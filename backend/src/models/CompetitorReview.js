const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// Avis d'un concurrent (module « Suivi des avis de la concurrence »). Table SÉPARÉE de `reviews` —
// jamais mêlée aux widgets/dashboard/tags/KPIs. Identifié par (location_id, place_id, external_id).
const CompetitorReview = sequelize.define('CompetitorReview', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:      { type: DataTypes.UUID, allowNull: false },
  location_id:      { type: DataTypes.UUID, allowNull: false },
  place_id:         { type: DataTypes.STRING, allowNull: false },
  external_id:      { type: DataTypes.STRING, allowNull: false },
  author_name:      { type: DataTypes.STRING },
  author_image_url: { type: DataTypes.TEXT },
  rating:           { type: DataTypes.INTEGER },
  text:             { type: DataTypes.TEXT },
  published_at:     { type: DataTypes.DATE },
}, {
  tableName: 'competitor_reviews',
  underscored: true,
  updatedAt: false,
})

module.exports = CompetitorReview
