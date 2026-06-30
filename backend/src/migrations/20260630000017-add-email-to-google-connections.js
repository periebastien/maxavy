'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('google_connections', 'google_account_email', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('google_connections', 'google_account_email')
  },
}
