const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const InvitationCampaign = sequelize.define('InvitationCampaign', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:  { type: DataTypes.UUID, allowNull: false },
  location_id:  { type: DataTypes.UUID },
  name:         { type: DataTypes.STRING, allowNull: false },
  channel:      { type: DataTypes.ENUM('email', 'sms', 'whatsapp'), defaultValue: 'email' },
  rate_per_day: { type: DataTypes.INTEGER },
  rate_per_week:{ type: DataTypes.INTEGER },
  total_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
  sent_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
  failed_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  status:       { type: DataTypes.ENUM('running', 'paused', 'completed', 'cancelled'), defaultValue: 'running' },
}, { tableName: 'invitation_campaigns', underscored: true })

module.exports = InvitationCampaign
