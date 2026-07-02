'use strict'

// Agrégats d'un concurrent sur un scan donné (même règle que la fiche : non-classé/hors profondeur
// mesurée = 21, cf. NOT_RANKED côté scan.service.js). GEOGRID_REFONTE_FR.md §3.1, §4.1, §16.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_scan_competitors', {
      id:            { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      scan_id:       { type: Sequelize.UUID, allowNull: false, references: { model: 'geogrid_scans', key: 'id' }, onDelete: 'CASCADE' },
      business_id:   { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      place_id:      { type: Sequelize.STRING, allowNull: false },
      name:          { type: Sequelize.STRING },
      avg_position:  { type: Sequelize.DECIMAL(6, 2) }, // position moyenne (couverture), non-classé/hors profondeur = 21
      points_top3:   { type: Sequelize.INTEGER, defaultValue: 0 },
      points_top10:  { type: Sequelize.INTEGER, defaultValue: 0 },
      points_top20:  { type: Sequelize.INTEGER, defaultValue: 0 },
      appearances:   { type: Sequelize.INTEGER, defaultValue: 0 }, // nb de points où ce concurrent est présent dans la profondeur mesurée
      created_at:    { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_scan_competitors', ['scan_id'], { name: 'geogrid_scan_competitors_scan_idx' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_scan_competitors')
  },
}
