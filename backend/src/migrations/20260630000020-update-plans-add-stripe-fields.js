'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plans', 'description',          { type: Sequelize.TEXT })
    await queryInterface.addColumn('plans', 'stripe_product_id',    { type: Sequelize.STRING })
    await queryInterface.addColumn('plans', 'stripe_price_id',      { type: Sequelize.STRING })
    await queryInterface.addColumn('plans', 'stripe_price_id_yearly', { type: Sequelize.STRING })
    await queryInterface.addColumn('plans', 'active',               { type: Sequelize.BOOLEAN, defaultValue: true })
    await queryInterface.addColumn('plans', 'sort_order',           { type: Sequelize.INTEGER, defaultValue: 0 })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('plans', 'description')
    await queryInterface.removeColumn('plans', 'stripe_product_id')
    await queryInterface.removeColumn('plans', 'stripe_price_id')
    await queryInterface.removeColumn('plans', 'stripe_price_id_yearly')
    await queryInterface.removeColumn('plans', 'active')
    await queryInterface.removeColumn('plans', 'sort_order')
  }
}
