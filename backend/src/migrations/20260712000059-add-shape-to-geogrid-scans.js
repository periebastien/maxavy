'use strict'

// Snapshot de la forme de grille (carré/losange/etc.) au moment du scan — nécessaire pour reconstituer
// la signature géométrique complète d'un scan (S1, continuité "zone commune" des courbes lors d'un
// changement de taille de grille). NULL = scan antérieur à cette colonne (forme non connue rétroactivement).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_scans', 'shape', { type: Sequelize.STRING })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('geogrid_scans', 'shape')
  },
}
