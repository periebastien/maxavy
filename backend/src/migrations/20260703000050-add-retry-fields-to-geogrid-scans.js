'use strict'

// Résilience du cron geogrid (retry + étalement) — colonnes de reprise sur les scans.
// attempts : nombre de reprises déjà consommées. next_attempt_at : quand retenter (NULL = aucune reprise
// programmée). retry_reason : 'transport' (0 tâche postée → re-soumission sûre, aucune double facturation)
// ou 'partial' (des tâches déjà payées attendent → re-poll gratuit, jamais de re-POST).
// Découplé de la cadence, qui reste portée par geogrid_configs.next_run_at — GEOGRID_REFONTE_FR.md §7.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_scans', 'attempts', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 })
    await queryInterface.addColumn('geogrid_scans', 'next_attempt_at', { type: Sequelize.DATE })
    await queryInterface.addColumn('geogrid_scans', 'retry_reason', { type: Sequelize.STRING })
    // Index partiel : le sélecteur de reprise (relaunchDueRetryScans) ne balaie que les lignes en attente.
    await queryInterface.addIndex('geogrid_scans', ['next_attempt_at'], {
      name: 'geogrid_scans_next_attempt_idx',
      where: { next_attempt_at: { [Sequelize.Op.ne]: null } },
    })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_scans', 'geogrid_scans_next_attempt_idx')
    await queryInterface.removeColumn('geogrid_scans', 'retry_reason')
    await queryInterface.removeColumn('geogrid_scans', 'next_attempt_at')
    await queryInterface.removeColumn('geogrid_scans', 'attempts')
  },
}
