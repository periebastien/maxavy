'use strict'

// Cutover G6 (GEOGRID_REFONTE_FR.md §16) : grid_size/grid_spacing_m/frequency/last_scanned_at quittent
// définitivement le mot-clé — la grille et le planning vivent sur geogrid_configs (G5) et le cron/service
// ont été réécrits en conséquence dans le même commit (scan.service.js, rank-tracking.service.js).
// Sûr : la migration 38 (G5) a déjà recopié ces valeurs dans geogrid_configs pour toutes les localisations
// concernées, et le frontend actuel n'a jamais lu/écrit ces champs au niveau mot-clé (vérifié).

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('geogrid_keywords', 'geogrid_keywords_due_idx')
    await queryInterface.removeColumn('geogrid_keywords', 'last_scanned_at')
    await queryInterface.removeColumn('geogrid_keywords', 'frequency')
    await queryInterface.removeColumn('geogrid_keywords', 'grid_spacing_m')
    await queryInterface.removeColumn('geogrid_keywords', 'grid_size')
    // Postgres ne supprime pas le type ENUM avec la colonne — le nettoyer pour que down() puisse le recréer.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_geogrid_keywords_frequency"')
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_keywords', 'grid_size', { type: Sequelize.INTEGER, defaultValue: 7 })
    await queryInterface.addColumn('geogrid_keywords', 'grid_spacing_m', { type: Sequelize.INTEGER, defaultValue: 500 })
    await queryInterface.addColumn('geogrid_keywords', 'frequency', { type: Sequelize.ENUM('weekly', 'daily'), defaultValue: 'weekly' })
    await queryInterface.addColumn('geogrid_keywords', 'last_scanned_at', { type: Sequelize.DATE })
    await queryInterface.addIndex('geogrid_keywords', ['active', 'last_scanned_at'], { name: 'geogrid_keywords_due_idx' })
  },
}
