'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('locations', {
      id:              { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:     { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      name:            { type: Sequelize.STRING, allowNull: false },
      address:         { type: Sequelize.TEXT },
      lat:             { type: Sequelize.DECIMAL(10, 7) },
      lng:             { type: Sequelize.DECIMAL(10, 7) },
      google_place_id: { type: Sequelize.STRING },
      created_at:      { type: Sequelize.DATE, allowNull: false },
      updated_at:      { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('locations')
  }
}
