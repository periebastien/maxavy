'use strict'

// NULL = job pour la fiche du business elle-même (comportement inchangé, session 21).
// Non NULL = job de synchro pour l'avis d'un concurrent (place_id) sur cette localisation — même
// mécanique task_post/tasks_ready/task_get, même cron, même tasks_ready partagé.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('review_sync_jobs', 'competitor_place_id', { type: Sequelize.STRING, allowNull: true })
    // Garde anti-double-job PAR concurrent (hasActiveJob(locationId, placeId)) — l'index existant
    // (location_id, status) ne suffit plus à lui seul à distinguer les jobs "ma fiche" des jobs concurrents.
    await queryInterface.addIndex('review_sync_jobs', ['location_id', 'competitor_place_id', 'status'], {
      name: 'review_sync_jobs_location_competitor_status_idx',
    })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('review_sync_jobs', 'review_sync_jobs_location_competitor_status_idx')
    await queryInterface.removeColumn('review_sync_jobs', 'competitor_place_id')
  },
}
