'use strict'

// run_id : rattache un scan au rapport qui l'a déclenché. Nullable — l'historique G1→G4 (scans "legacy",
// sans notion de rapport) reste null et continue de s'afficher normalement. onDelete SET NULL : supprimer
// un run ne doit pas supprimer les scans (données historiques précieuses).
// points_top3/10/20 : compteurs figés au finalize (comme arp/atrp/solv), cf. GEOGRID_REFONTE_FR.md §16.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_scans', 'run_id', {
      type: Sequelize.UUID,
      references: { model: 'geogrid_runs', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addColumn('geogrid_scans', 'points_top3', { type: Sequelize.INTEGER })
    await queryInterface.addColumn('geogrid_scans', 'points_top10', { type: Sequelize.INTEGER })
    await queryInterface.addColumn('geogrid_scans', 'points_top20', { type: Sequelize.INTEGER })
    await queryInterface.addIndex('geogrid_scans', ['run_id'], { name: 'geogrid_scans_run_idx' })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_scans', 'geogrid_scans_run_idx')
    await queryInterface.removeColumn('geogrid_scans', 'points_top20')
    await queryInterface.removeColumn('geogrid_scans', 'points_top10')
    await queryInterface.removeColumn('geogrid_scans', 'points_top3')
    await queryInterface.removeColumn('geogrid_scans', 'run_id')
  },
}
