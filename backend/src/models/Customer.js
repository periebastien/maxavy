const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Customer = sequelize.define('Customer', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:      { type: DataTypes.UUID, allowNull: false },
  firstname:        { type: DataTypes.STRING },
  lastname:         { type: DataTypes.STRING },
  email:            { type: DataTypes.TEXT },
  phone:            { type: DataTypes.TEXT },
  status:           { type: DataTypes.ENUM('pending', 'invited', 'reviewed'), defaultValue: 'pending' },
  consent_given:    { type: DataTypes.BOOLEAN, defaultValue: false },
  consent_given_at: { type: DataTypes.DATE },
  consent_given_by: { type: DataTypes.UUID },
}, {
  tableName: 'customers',
  underscored: true,
})

module.exports = Customer
