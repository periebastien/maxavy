const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Location = sequelize.define('Location', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  business_id:       { type: DataTypes.UUID, allowNull: false },
  name:              { type: DataTypes.STRING, allowNull: false },
  slug:              { type: DataTypes.STRING }, // unique par entreprise — URL publique de collecte
  address:           { type: DataTypes.TEXT },
  lat:               { type: DataTypes.DECIMAL(10, 7) },
  lng:               { type: DataTypes.DECIMAL(10, 7) },
  google_place_id:   { type: DataTypes.STRING, allowNull: false }, // fiche GMB obligatoire (décision produit)
  google_place_name: { type: DataTypes.STRING },
  website_url:       { type: DataTypes.STRING }, // site de la fiche Google (sert au favicon/logo)
}, {
  tableName: 'locations',
  underscored: true,
})

module.exports = Location
