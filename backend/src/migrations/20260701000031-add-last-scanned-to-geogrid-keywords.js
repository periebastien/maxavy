'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Horodatage du dernier scan lancé pour ce mot-clé — pilote la détection « dû » du cron (G3).
    // Posé à la création d'un scan (auto ou manuel) → un mot-clé n'est relancé qu'après sa fenêtre
    // (hebdo = 7 j / quotidien = 1 j). null = jamais scanné → dû immédiatement.
    await queryInterface.addColumn('geogrid_keywords', 'last_scanned_at', { type: Sequelize.DATE })
    await queryInterface.addIndex('geogrid_keywords', ['active', 'last_scanned_at'], { name: 'geogrid_keywords_due_idx' })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_keywords', 'geogrid_keywords_due_idx')
    await queryInterface.removeColumn('geogrid_keywords', 'last_scanned_at')
  },
}
