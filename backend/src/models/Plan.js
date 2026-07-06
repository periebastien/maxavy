const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Plan = sequelize.define('Plan', {
  id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:                  { type: DataTypes.STRING, allowNull: false },
  description:           { type: DataTypes.TEXT },
  price:                 { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  monthly_credits:       { type: DataTypes.INTEGER, defaultValue: 0 },
  features:              { type: DataTypes.JSONB, defaultValue: [] },
  module_quotas:         { type: DataTypes.JSONB, defaultValue: {} }, // config machine-readable par module_key. rank_tracking (legacy G1-G4): { enabled, max_keywords, grid_size, grid_spacing_m, frequency }, enrichi (refonte G5+): + { max_grid_size, allowed_shapes, allowed_frequencies, max_competitors } — cutover complet des anciennes clés prévu en G6. Éditable en Super Admin (G12).
  stripe_product_id:     { type: DataTypes.STRING },
  stripe_price_id:       { type: DataTypes.STRING },
  stripe_price_id_yearly: { type: DataTypes.STRING },
  active:                { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:            { type: DataTypes.INTEGER, defaultValue: 0 },
  max_businesses:        { type: DataTypes.INTEGER }, // NULL = illimité. Limite le nombre d'entreprises qu'un propriétaire peut créer.
  max_locations:         { type: DataTypes.INTEGER }, // NULL = illimité. Limite le nombre de localisations par entreprise.
}, { tableName: 'plans', underscored: true })

module.exports = Plan
