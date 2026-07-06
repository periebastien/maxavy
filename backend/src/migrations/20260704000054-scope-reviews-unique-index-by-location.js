'use strict'

// Correctif audit sécurité : l'index unique (platform, external_id) créé en migration 45 est GLOBAL.
// Si deux fiches (locations) partagent le même place_id Google (franchise, erreur de saisie...), un
// upsert sur la fiche B écrase l'avis déjà stocké pour la fiche A (vol/écrasement d'avis inter-tenant).
// Remplacé par un index unique scopé (location_id, platform, external_id) — cohérent avec le scoping déjà
// en place sur competitor_reviews (migration 47, `competitor_reviews_location_place_external_uniq`).

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('reviews', 'reviews_platform_external_id_uniq')
    await queryInterface.addIndex('reviews', ['location_id', 'platform', 'external_id'], {
      unique: true,
      name: 'reviews_location_platform_external_id_uniq',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('reviews', 'reviews_location_platform_external_id_uniq')
    await queryInterface.addIndex('reviews', ['platform', 'external_id'], {
      unique: true,
      name: 'reviews_platform_external_id_uniq',
    })
  },
}
