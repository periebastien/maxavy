'use strict'

// Synchro des avis via DataForSEO (business_data/google/reviews), en remplacement de l'API GMB (quota
// bloqué). Un « job » = 1 tâche DataForSEO pour 1 localisation (contrairement au geogrid : ici 1 tâche
// par fiche, pas 25-49 points). Pattern asynchrone identique : task_post → tasks_ready → task_get.
// Les colonnes de planification vivent sur `locations` (1 fiche = 1 cadence), pilotées par le quota du plan.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('review_sync_jobs', {
      id:               { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:      { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:      { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      provider:         { type: Sequelize.STRING, defaultValue: 'dataforseo' },
      provider_task_id: { type: Sequelize.STRING },
      kind:             { type: Sequelize.ENUM('backfill', 'incremental'), allowNull: false },
      status:           { type: Sequelize.ENUM('pending', 'running', 'done', 'failed'), defaultValue: 'pending' },
      depth:            { type: Sequelize.INTEGER, allowNull: false },
      sort_by:          { type: Sequelize.STRING, defaultValue: 'newest' },
      reviews_found:    { type: Sequelize.INTEGER, defaultValue: 0 },
      reviews_upserted: { type: Sequelize.INTEGER, defaultValue: 0 },
      cost:             { type: Sequelize.FLOAT, defaultValue: 0 }, // coût USD DataForSEO de la tâche
      error_message:    { type: Sequelize.TEXT },
      started_at:       { type: Sequelize.DATE },
      finished_at:      { type: Sequelize.DATE },
      created_at:       { type: Sequelize.DATE, allowNull: false },
    })
    // poll global (status running) + failStuck ; garde anti-double-job (location_id, status)
    await queryInterface.addIndex('review_sync_jobs', ['status'], { name: 'review_sync_jobs_status_idx' })
    await queryInterface.addIndex('review_sync_jobs', ['location_id', 'status'], { name: 'review_sync_jobs_location_status_idx' })

    // Planification par localisation. next_reviews_sync_at NULL = jamais synchronisée → due immédiatement
    // (1er passage = backfill). reviews_backfilled_at marque que l'historique profond a été récupéré une fois.
    await queryInterface.addColumn('locations', 'last_reviews_sync_at', { type: Sequelize.DATE })
    await queryInterface.addColumn('locations', 'next_reviews_sync_at', { type: Sequelize.DATE })
    await queryInterface.addColumn('locations', 'reviews_backfilled_at', { type: Sequelize.DATE })
    await queryInterface.addIndex('locations', ['next_reviews_sync_at'], { name: 'locations_next_reviews_sync_idx' })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('locations', 'locations_next_reviews_sync_idx')
    await queryInterface.removeColumn('locations', 'reviews_backfilled_at')
    await queryInterface.removeColumn('locations', 'next_reviews_sync_at')
    await queryInterface.removeColumn('locations', 'last_reviews_sync_at')
    await queryInterface.dropTable('review_sync_jobs')
    // ENUM types créés par createTable — nettoyage explicite (Postgres ne les drop pas avec la table)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_review_sync_jobs_kind"')
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_review_sync_jobs_status"')
  },
}
