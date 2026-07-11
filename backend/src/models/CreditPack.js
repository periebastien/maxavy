const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const CreditPack = sequelize.define('CreditPack', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  label:      { type: DataTypes.STRING, allowNull: false },
  credits:    { type: DataTypes.INTEGER, allowNull: false },
  price:      { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'credit_packs',
  underscored: true,
})

module.exports = CreditPack
