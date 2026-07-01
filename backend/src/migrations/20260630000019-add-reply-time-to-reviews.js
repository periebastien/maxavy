'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'reply_time', {
      type: Sequelize.DATE,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'reply_time')
  }
}
