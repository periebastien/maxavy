'use strict'

// Garde-fou d'intégrité : un concurrent ne doit avoir qu'une ligne d'agrégat par scan. Le code
// (competitor.service.js) fait déjà un delete-then-insert avant chaque calcul (idempotent sans compter
// sur cet index), mais la contrainte explicite protège contre un futur bug d'écriture concurrente.

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('geogrid_scan_competitors', ['scan_id', 'place_id'], {
      unique: true,
      name: 'geogrid_scan_competitors_scan_place_unique',
    })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_scan_competitors', 'geogrid_scan_competitors_scan_place_unique')
  },
}
