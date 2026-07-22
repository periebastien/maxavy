const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const GoogleConnection = sequelize.define('GoogleConnection', {
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:          { type: DataTypes.UUID, allowNull: false },
  access_token:         { type: DataTypes.TEXT },
  refresh_token:        { type: DataTypes.TEXT },
  scopes:               { type: DataTypes.TEXT },
  expires_at:           { type: DataTypes.DATE },
  last_synced_at:       { type: DataTypes.DATE },
  google_account_email: { type: DataTypes.STRING },
  verified_location_match: { type: DataTypes.BOOLEAN, allowNull: true },
  verification_error:      { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'google_connections', underscored: true })

module.exports = GoogleConnection
