'use strict'

// Avis des concurrents (module « Suivi des avis de la concurrence », AVIS_CONCURRENTS_FR.md §3).
// Table SÉPARÉE de `reviews` — jamais mêlée aux widgets/dashboard/tags/KPIs de l'entreprise elle-même.
// Identifié par (location_id, place_id) — PAS de FK vers geogrid_competitors : la liste de concurrents
// suivis est actuellement celle du positionnement, mais ce découplage permet de la remplacer plus tard
// sans toucher aux données déjà collectées (§9).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('competitor_reviews', {
      id:               { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:      { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:      { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      place_id:         { type: Sequelize.STRING, allowNull: false },
      external_id:      { type: Sequelize.STRING, allowNull: false },
      author_name:      { type: Sequelize.STRING },
      author_image_url: { type: Sequelize.TEXT },
      rating:           { type: Sequelize.INTEGER },
      text:             { type: Sequelize.TEXT },
      published_at:     { type: Sequelize.DATE },
      created_at:       { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('competitor_reviews', ['location_id', 'place_id', 'external_id'], {
      unique: true,
      name: 'competitor_reviews_location_place_external_uniq',
    })
    // GROUP BY mois (stats §5) : filtre location_id+place_id, tri published_at
    await queryInterface.addIndex('competitor_reviews', ['location_id', 'place_id', 'published_at'], {
      name: 'competitor_reviews_location_place_published_idx',
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('competitor_reviews')
  },
}
