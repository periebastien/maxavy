'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_keywords', {
      id:             { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:    { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:    { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      keyword:        { type: Sequelize.STRING, allowNull: false },
      grid_size:      { type: Sequelize.INTEGER, defaultValue: 7 },
      grid_spacing_m: { type: Sequelize.INTEGER, defaultValue: 500 },
      frequency:      { type: Sequelize.ENUM('weekly', 'daily'), defaultValue: 'weekly' },
      active:         { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at:     { type: Sequelize.DATE, allowNull: false },
      updated_at:     { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_keywords', ['location_id', 'keyword'], { unique: true, name: 'geogrid_keywords_location_keyword_unique' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_keywords')
  },
}
