'use strict'
// google_place_id est une invariante produit : toute localisation a obligatoirement une fiche Google.
// Le modèle Sequelize (Location.js) la déclare déjà allowNull:false ; on aligne la contrainte en base
// (defense-in-depth : protège contre tout write hors service — SQL direct, seed, futur module).
// Aucun backfill nécessaire (projet en dev, repart de zéro, aucune ligne existante).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('locations', 'google_place_id', {
      type: Sequelize.STRING,
      allowNull: false,
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('locations', 'google_place_id', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },
}
