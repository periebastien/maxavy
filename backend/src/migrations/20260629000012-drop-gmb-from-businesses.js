'use strict'
// Les données Google Places vivent désormais au niveau localisation (table locations).
// On retire les colonnes du niveau entreprise. Projet en dev : pas de backfill (repart à zéro).
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('businesses', 'google_place_id')
    await queryInterface.removeColumn('businesses', 'google_place_name')
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('businesses', 'google_place_id', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
    await queryInterface.addColumn('businesses', 'google_place_name', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
  },
}
