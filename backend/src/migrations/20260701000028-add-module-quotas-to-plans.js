'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plans', 'module_quotas', { type: Sequelize.JSONB, defaultValue: {} })

    // Quotas geogrid par plan (cahier §9.5 / §10, GEOGRID_DESIGN_FR.md §7).
    // Gratuit : pas de clé rank_tracking → module désactivé. Starter figé à 5 mots-clés (décision produit) ;
    // Pro/Agence = valeurs indicatives, à ajuster plus tard.
    await queryInterface.sequelize.query(`
      UPDATE plans SET module_quotas = '{"rank_tracking":{"enabled":true,"max_keywords":5,"grid_size":7,"grid_spacing_m":500,"frequency":"weekly"}}'::jsonb
      WHERE name = 'Starter'
    `)
    await queryInterface.sequelize.query(`
      UPDATE plans SET module_quotas = '{"rank_tracking":{"enabled":true,"max_keywords":15,"grid_size":9,"grid_spacing_m":500,"frequency":"weekly"}}'::jsonb
      WHERE name = 'Pro'
    `)
    await queryInterface.sequelize.query(`
      UPDATE plans SET module_quotas = '{"rank_tracking":{"enabled":true,"max_keywords":50,"grid_size":13,"grid_spacing_m":500,"frequency":"weekly"}}'::jsonb
      WHERE name = 'Agence'
    `)
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('plans', 'module_quotas')
  },
}
