'use strict'

const { computeNextRunAt } = require('../modules/rank-tracking/schedule.utils')

// Les configs créées par la migration 38 (G5) n'ont pas de next_run_at (le champ n'existait pas encore
// dans cette logique de planification). Sans cette étape, le premier tick du cron après le déploiement
// de G6 les considérerait « dues » immédiatement (règle NULLS FIRST = dû, cf. findDueConfigs) et
// lancerait un scan réel (facturé chez le fournisseur) sans délai — surprise à éviter, en particulier
// sur la démo. On leur donne une vraie première occurrence, calculée comme le ferait une création normale.

module.exports = {
  async up(queryInterface) {
    const [configs] = await queryInterface.sequelize.query(
      `SELECT c.id, c.frequency, c.run_hour, c.run_day_of_week, c.run_day_of_month, c.timezone, b.timezone AS business_timezone
       FROM geogrid_configs c JOIN businesses b ON b.id = c.business_id
       WHERE c.next_run_at IS NULL`
    )
    for (const cfg of configs) {
      const timezone = cfg.timezone || cfg.business_timezone || 'Europe/Paris'
      const nextRunAt = computeNextRunAt(cfg, timezone)
      await queryInterface.sequelize.query(
        'UPDATE geogrid_configs SET next_run_at = :nextRunAt WHERE id = :id',
        { replacements: { nextRunAt, id: cfg.id } }
      )
    }
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('UPDATE geogrid_configs SET next_run_at = NULL')
  },
}
