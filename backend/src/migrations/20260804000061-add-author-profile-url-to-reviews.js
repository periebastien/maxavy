'use strict'

// Lien vers la fiche contributeur Google Maps de l'auteur — DataForSEO le fournit dans `profile_url`
// des items de /reviews/task_get. Nullable — les avis déjà en base ne seront remplis qu'à la prochaine synchro.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'author_profile_url', { type: Sequelize.TEXT, allowNull: true })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'author_profile_url')
  },
}
