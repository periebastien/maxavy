const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Location = sequelize.define('Location', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:       { type: DataTypes.UUID, allowNull: false },
  name:              { type: DataTypes.STRING, allowNull: false },
  slug:              { type: DataTypes.STRING }, // unique par entreprise — URL publique de collecte
  address:           { type: DataTypes.TEXT },
  lat:               { type: DataTypes.DECIMAL(10, 7) },
  lng:               { type: DataTypes.DECIMAL(10, 7) },
  google_place_id:   { type: DataTypes.STRING, allowNull: false }, // fiche GMB obligatoire (décision produit)
  google_place_name: { type: DataTypes.STRING },
  website_url:       { type: DataTypes.STRING }, // site de la fiche Google (sert au favicon/logo)
  // Synchro des avis via DataForSEO (planification par fiche, cadence = quota du plan)
  last_reviews_sync_at:  { type: DataTypes.DATE },
  next_reviews_sync_at:  { type: DataTypes.DATE }, // NULL = jamais synchronisée → due immédiatement (backfill)
  reviews_backfilled_at: { type: DataTypes.DATE }, // NULL = backfill initial pas encore fait
  total_reviews_count:   { type: DataTypes.INTEGER }, // snapshot DataForSEO (reviews_count) — règle de complétude AC2
  avg_rating:            { type: DataTypes.FLOAT },   // snapshot — moyenne du dernier lot résolu
}, {
  tableName: 'locations',
  underscored: true,
})

module.exports = Location
