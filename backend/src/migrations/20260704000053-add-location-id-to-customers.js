'use strict'

// NULL = client visible sur toutes les localisations du business (clients existants inchangés).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('customers', 'location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addIndex('customers', ['business_id', 'location_id'], {
      name: 'customers_business_location_idx',
    })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('customers', 'customers_business_location_idx')
    await queryInterface.removeColumn('customers', 'location_id')
  },
}
