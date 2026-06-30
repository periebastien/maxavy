const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Business = sequelize.define('Business', {
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  owner_id:             { type: DataTypes.UUID, allowNull: false },
  plan_id:              { type: DataTypes.UUID },
  name:                 { type: DataTypes.STRING, allowNull: false },
  slug:                 { type: DataTypes.STRING, allowNull: false, unique: true },
  website_url:          { type: DataTypes.STRING },
  country:              { type: DataTypes.STRING, defaultValue: 'FR' },
  timezone:             { type: DataTypes.STRING, defaultValue: 'Europe/Paris' },
  feedback_page_config: { type: DataTypes.JSONB, defaultValue: {} },
  credit_balance:       { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'businesses',
  underscored: true,
})

module.exports = Business
