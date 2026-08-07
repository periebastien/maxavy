'use strict'

// Lien direct vers l'avis + statistiques de l'auteur (Local Guide, nombre d'avis publiés) — DataForSEO
// les fournit dans `review_url` / `local_guide` / `reviews_count` (niveau item) des items de
// /reviews/task_get. Nullable — les avis déjà en base ne seront remplis qu'à la prochaine synchro.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'review_url', { type: Sequelize.TEXT, allowNull: true })
    await queryInterface.addColumn('reviews', 'author_is_local_guide', { type: Sequelize.BOOLEAN, allowNull: true })
    await queryInterface.addColumn('reviews', 'author_reviews_count', { type: Sequelize.INTEGER, allowNull: true })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'review_url')
    await queryInterface.removeColumn('reviews', 'author_is_local_guide')
    await queryInterface.removeColumn('reviews', 'author_reviews_count')
  },
}
