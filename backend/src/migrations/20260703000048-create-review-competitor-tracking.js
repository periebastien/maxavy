'use strict'

// Miroir des concurrents ACTUELLEMENT suivis pour le module avis (1 ligne = 1 concurrent en cours de
// synchro pour une localisation). Réconcilié par le cron à partir de geogrid_competitors (liste partagée,
// AVIS_CONCURRENTS_FR.md §2.2) — jamais écrit depuis le module rank-tracking lui-même. Un concurrent
// retiré de la liste geogrid fait disparaître sa ligne ici (synchro stoppée) mais ses `competitor_reviews`
// sont conservés (§2.8).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('review_competitor_tracking', {
      id:                   { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:          { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:          { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      place_id:             { type: Sequelize.STRING, allowNull: false },
      name:                 { type: Sequelize.STRING }, // copie du nom au moment du suivi (affichage sans jointure)
      total_reviews_count:  { type: Sequelize.INTEGER }, // snapshot DataForSEO (reviews_count de la réponse)
      avg_rating:           { type: Sequelize.FLOAT },   // snapshot — moyenne du dernier lot d'avis résolu
      last_synced_at:       { type: Sequelize.DATE },
      next_sync_at:         { type: Sequelize.DATE }, // NULL = jamais synchronisé → dû immédiatement (backfill)
      backfilled_at:        { type: Sequelize.DATE }, // NULL = backfill initial pas encore fait
      created_at:           { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('review_competitor_tracking', ['location_id', 'place_id'], {
      unique: true,
      name: 'review_competitor_tracking_location_place_uniq',
    })
    await queryInterface.addIndex('review_competitor_tracking', ['next_sync_at'], {
      name: 'review_competitor_tracking_next_sync_idx',
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('review_competitor_tracking')
  },
}
