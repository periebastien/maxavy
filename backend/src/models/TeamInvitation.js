const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const TeamInvitation = sequelize.define('TeamInvitation', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  email:       { type: DataTypes.TEXT, allowNull: false }, // chiffré AES-256-GCM
  email_hash:  { type: DataTypes.STRING, allowNull: false }, // SHA-256 pour lookup
  role:        { type: DataTypes.ENUM('admin', 'editor', 'viewer'), allowNull: false, defaultValue: 'viewer' },
  token_hash:  { type: DataTypes.STRING, allowNull: false },
  status:      { type: DataTypes.ENUM('pending', 'accepted', 'revoked'), allowNull: false, defaultValue: 'pending' },
  invited_by:  { type: DataTypes.UUID },
  expires_at:  { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'team_invitations',
  underscored: true,
  updatedAt: false,
})

module.exports = TeamInvitation
