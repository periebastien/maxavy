'use strict'

// Session 32 (complément) — quotas plan : nombre max d'entreprises par propriétaire et de
// localisations par entreprise. NULL = illimité (défaut, zéro régression tant que le Super Admin
// ne fixe pas de plafond explicite).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plans', 'max_businesses', {
      type: Sequelize.INTEGER, allowNull: true,
    })
    await queryInterface.addColumn('plans', 'max_locations', {
      type: Sequelize.INTEGER, allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('plans', 'max_businesses')
    await queryInterface.removeColumn('plans', 'max_locations')
  },
}
