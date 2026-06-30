const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const User = sequelize.define('User', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email:          { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash:  { type: DataTypes.STRING, allowNull: true },
  firstname:      { type: DataTypes.STRING },
  lastname:       { type: DataTypes.STRING },
  phone:          { type: DataTypes.STRING },
  avatar_url:     { type: DataTypes.STRING },
  role:           { type: DataTypes.ENUM('superadmin', 'owner', 'member'), defaultValue: 'owner' },
  email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  google_id:      { type: DataTypes.STRING, allowNull: true, unique: true },
  auth_provider:  { type: DataTypes.ENUM('local', 'google'), defaultValue: 'local' },
}, {
  tableName: 'users',
  underscored: true,
})

module.exports = User
