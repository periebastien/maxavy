'use strict'

// Vérification compte Google <-> fiche gérée (place_id) au callback OAuth.
// null = vérification non effectuée (API Google Business Profile non dispo / erreur / quota) -> pas de bruit front.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('google_connections', 'verified_location_match', { type: Sequelize.BOOLEAN, allowNull: true })
    await queryInterface.addColumn('google_connections', 'verification_error', { type: Sequelize.TEXT, allowNull: true })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('google_connections', 'verified_location_match')
    await queryInterface.removeColumn('google_connections', 'verification_error')
  },
}
