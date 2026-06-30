const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Invitation = sequelize.define('Invitation', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customer_id: { type: DataTypes.UUID, allowNull: false },
  business_id: { type: DataTypes.UUID, allowNull: false },
  channel:     { type: DataTypes.ENUM('email', 'sms', 'whatsapp'), defaultValue: 'email' },
  sent_at:     { type: DataTypes.DATE },
  status:      { type: DataTypes.ENUM('pending', 'sent', 'failed'), defaultValue: 'pending' },
}, {
  tableName: 'invitations',
  underscored: true,
  updatedAt: false,
})

module.exports = Invitation
