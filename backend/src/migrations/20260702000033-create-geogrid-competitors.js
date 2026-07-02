'use strict'

// Concurrents suivis par configuration (GEOGRID_REFONTE_FR.md §3.1, §9). Coût data nul : les concurrents
// sont déjà présents dans les résultats récupérés par point (geogrid_points.competitors).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_competitors', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      config_id:   { type: Sequelize.UUID, allowNull: false, references: { model: 'geogrid_configs', key: 'id' }, onDelete: 'CASCADE' },
      place_id:    { type: Sequelize.STRING, allowNull: false },
      name:        { type: Sequelize.STRING },
      active:      { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at:  { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_competitors', ['config_id', 'place_id'], { unique: true, name: 'geogrid_competitors_config_place_unique' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_competitors')
  },
}
