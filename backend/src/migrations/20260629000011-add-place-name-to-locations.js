'use strict'
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('locations', 'google_place_name', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('locations', 'google_place_name')
  },
}
