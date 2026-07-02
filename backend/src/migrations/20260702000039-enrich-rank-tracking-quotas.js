'use strict'

// Enrichit plans.module_quotas.rank_tracking avec les nouveaux plafonds de la refonte (formes, fréquences,
// concurrents, grille max) — GEOGRID_REFONTE_FR.md §3.2, §11.1. ADDITIF UNIQUEMENT : fusion jsonb (||),
// les clés existantes (enabled, max_keywords, grid_size, grid_spacing_m, frequency) restent inchangées
// pour ne pas casser le code actuel (normalizeGridSize/normalizeFrequency). Le cutover vers les nouvelles
// clés (renommage, suppression des anciennes) se fait en G6. Éditable ensuite en Super Admin (session G12).

const QUOTAS = {
  Starter: { max_grid_size: 7, allowed_shapes: ['square', 'circle'], allowed_frequencies: ['monthly', 'weekly'], max_competitors: 3 },
  Pro: { max_grid_size: 9, allowed_shapes: ['square', 'circle'], allowed_frequencies: ['monthly', 'weekly'], max_competitors: 5 },
  Agence: { max_grid_size: 13, allowed_shapes: ['square', 'circle'], allowed_frequencies: ['monthly', 'weekly', 'daily'], max_competitors: 10 },
}

module.exports = {
  async up(queryInterface) {
    for (const [planName, extra] of Object.entries(QUOTAS)) {
      await queryInterface.sequelize.query(
        `UPDATE plans
         SET module_quotas = jsonb_set(module_quotas, '{rank_tracking}', (module_quotas->'rank_tracking') || :extra::jsonb)
         WHERE name = :planName AND module_quotas ? 'rank_tracking'`,
        { replacements: { planName, extra: JSON.stringify(extra) } }
      )
    }
  },
  async down(queryInterface) {
    const keys = ['max_grid_size', 'allowed_shapes', 'allowed_frequencies', 'max_competitors']
    for (const planName of Object.keys(QUOTAS)) {
      for (const key of keys) {
        await queryInterface.sequelize.query(
          `UPDATE plans SET module_quotas = jsonb_set(module_quotas, '{rank_tracking}', (module_quotas->'rank_tracking') - :key)
           WHERE name = :planName AND module_quotas ? 'rank_tracking'`,
          { replacements: { planName, key } }
        )
      }
    }
  },
}
