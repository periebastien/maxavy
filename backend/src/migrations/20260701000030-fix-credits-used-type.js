'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // credits_used stocke un coût fournisseur en dollars (fractionnaire, ex 0.0006 $/tâche) — pas un entier.
    await queryInterface.changeColumn('geogrid_scans', 'credits_used', { type: Sequelize.DECIMAL(10, 4) })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('geogrid_scans', 'credits_used', { type: Sequelize.INTEGER })
  },
}
