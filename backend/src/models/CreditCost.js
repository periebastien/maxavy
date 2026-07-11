const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const CreditCost = sequelize.define('CreditCost', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  action_key: { type: DataTypes.STRING, allowNull: false, unique: true },
  cost:       { type: DataTypes.INTEGER, allowNull: false },
  label:      { type: DataTypes.STRING },
}, {
  tableName: 'credit_costs',
  underscored: true,
})

module.exports = CreditCost
