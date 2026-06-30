const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Credit = sequelize.define('Credit', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  amount:      { type: DataTypes.INTEGER, allowNull: false },
  action_type: { type: DataTypes.STRING },
  source:      { type: DataTypes.ENUM('plan', 'purchase', 'bonus'), defaultValue: 'plan' },
}, {
  tableName: 'credits',
  underscored: true,
  updatedAt: false,
})

module.exports = Credit
