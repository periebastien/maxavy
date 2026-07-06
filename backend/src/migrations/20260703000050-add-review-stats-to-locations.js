'use strict'

// Snapshot du total d'avis / note moyenne de LA FICHE ELLE-MÊME (symétrique à
// review_competitor_tracking.total_reviews_count/avg_rating, migration 48). Requis par la règle de
// complétude du module « Suivi des avis de la concurrence » (AVIS_CONCURRENTS_FR.md §2.6) : "s'applique
// aussi à la série « ma fiche »" — sans ce total connu, impossible de savoir si le backfill de la fiche a
// tout ramené (nb stocké >= total). Capturé dans resolveLocationJob, comme resolveCompetitorJob le fait
// déjà pour un concurrent.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('locations', 'total_reviews_count', { type: Sequelize.INTEGER, allowNull: true })
    await queryInterface.addColumn('locations', 'avg_rating', { type: Sequelize.FLOAT, allowNull: true })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('locations', 'avg_rating')
    await queryInterface.removeColumn('locations', 'total_reviews_count')
  },
}
