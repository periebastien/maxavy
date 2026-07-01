const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Plan = sequelize.define('Plan', {
  id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:                  { type: DataTypes.STRING, allowNull: false },
  description:           { type: DataTypes.TEXT },
  price:                 { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  monthly_credits:       { type: DataTypes.INTEGER, defaultValue: 0 },
  features:              { type: DataTypes.JSONB, defaultValue: [] },
  stripe_product_id:     { type: DataTypes.STRING },
  stripe_price_id:       { type: DataTypes.STRING },
  stripe_price_id_yearly: { type: DataTypes.STRING },
  active:                { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:            { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'plans', underscored: true })

module.exports = Plan
