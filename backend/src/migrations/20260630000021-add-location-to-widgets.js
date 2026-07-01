'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('widgets', 'location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onDelete: 'CASCADE',
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('widgets', 'location_id')
  },
}
