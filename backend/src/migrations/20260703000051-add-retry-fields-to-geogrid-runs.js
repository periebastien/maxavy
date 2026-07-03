'use strict'

// Résilience du cron geogrid — colonnes de reprise + hook d'alerte sur les rapports (runs).
// attempts / next_attempt_at : filet de sécurité au niveau run (Level C) quand tous les scans d'un rapport
// ont épuisé leurs reprises ou qu'un run a été créé sans scan exploitable. Distinct de la cadence.
// notify_failure : hook pour l'alerte email (module rapport G11, non encore branché) — posé à true quand un
// run se clôt en échec définitif ; G11 consommera le flag (envoi puis remise à false).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_runs', 'attempts', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 })
    await queryInterface.addColumn('geogrid_runs', 'next_attempt_at', { type: Sequelize.DATE })
    await queryInterface.addColumn('geogrid_runs', 'notify_failure', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false })
    await queryInterface.addIndex('geogrid_runs', ['next_attempt_at'], {
      name: 'geogrid_runs_next_attempt_idx',
      where: { next_attempt_at: { [Sequelize.Op.ne]: null } },
    })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_runs', 'geogrid_runs_next_attempt_idx')
    await queryInterface.removeColumn('geogrid_runs', 'notify_failure')
    await queryInterface.removeColumn('geogrid_runs', 'next_attempt_at')
    await queryInterface.removeColumn('geogrid_runs', 'attempts')
  },
}
