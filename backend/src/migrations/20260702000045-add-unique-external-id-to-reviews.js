'use strict'

// Contrainte unique nécessaire à Review.upsert (ON CONFLICT) pour la synchro DataForSEO. L'ancien code GMB
// la présupposait via conflictFields:['external_id'] mais elle n'a jamais existé (sync jamais exécuté, quota
// GMB bloqué). Clé (platform, external_id) : un review_id Google est unique ; les NULL restent tolérés
// (Postgres autorise plusieurs NULL dans un index unique) → n'impacte pas d'éventuels avis sans external_id.

module.exports = {
  async up(queryInterface) {
    // Dédoublonnage défensif avant l'index unique : garde la ligne la plus récente (created_at, puis id).
    await queryInterface.sequelize.query(`
      DELETE FROM reviews a USING reviews b
      WHERE a.external_id IS NOT NULL
        AND a.platform IS NOT DISTINCT FROM b.platform
        AND a.external_id = b.external_id
        AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id))
    `)
    await queryInterface.addIndex('reviews', ['platform', 'external_id'], {
      unique: true,
      name: 'reviews_platform_external_id_uniq',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('reviews', 'reviews_platform_external_id_uniq')
  },
}
