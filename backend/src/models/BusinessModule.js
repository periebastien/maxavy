const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

// Mappe la table existante `business_modules` (migration 20260629000008-create-remaining.js).
// Activation d'un module hors plan (ex: bêta chez un client précis), en surcouche du gating
// par plan (`plans.module_quotas`). ⚠️ Aucun module métier ne lit encore ce flag (session 32) —
// c'est uniquement la partie écriture/gestion (CRUD Super Admin).
const BusinessModule = sequelize.define('BusinessModule', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:  { type: DataTypes.UUID, allowNull: false },
  module_key:   { type: DataTypes.STRING, allowNull: false },
  enabled:      { type: DataTypes.BOOLEAN, defaultValue: false },
  activated_at: { type: DataTypes.DATE },
  settings:     { type: DataTypes.JSONB, defaultValue: {} },
}, {
  tableName: 'business_modules',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false, // pas de colonne updated_at sur cette table
})

module.exports = BusinessModule
