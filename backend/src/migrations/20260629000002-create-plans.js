'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plans', {
      id:              { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name:            { type: Sequelize.STRING, allowNull: false },
      monthly_credits: { type: Sequelize.INTEGER, defaultValue: 0 },
      price:           { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      features:        { type: Sequelize.JSONB, defaultValue: [] },
      created_at:      { type: Sequelize.DATE, allowNull: false },
      updated_at:      { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('plans')
  }
}
