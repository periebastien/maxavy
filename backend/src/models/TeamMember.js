const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const TeamMember = sequelize.define('TeamMember', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id: { type: DataTypes.UUID, allowNull: false },
  user_id:     { type: DataTypes.UUID, allowNull: false },
  role:        { type: DataTypes.ENUM('admin', 'editor', 'viewer'), defaultValue: 'viewer' },
  invited_at:  { type: DataTypes.DATE },
  accepted_at: { type: DataTypes.DATE },
}, {
  tableName: 'team_members',
  underscored: true,
  updatedAt: false,
})

module.exports = TeamMember
