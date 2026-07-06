'use strict'

// Avatar de l'auteur de l'avis — DataForSEO le fournit dans `profile_image_url`. Nullable (avis anonyme
// ou sans photo de profil → fallback initiale côté UI).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'author_image_url', { type: Sequelize.TEXT, allowNull: true })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'author_image_url')
  },
}
