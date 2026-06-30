'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      id:                 { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:        { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      firstname:          { type: Sequelize.STRING },
      lastname:           { type: Sequelize.STRING },
      email:              { type: Sequelize.TEXT },
      phone:              { type: Sequelize.TEXT },
      status:             { type: Sequelize.ENUM('pending', 'invited', 'reviewed'), defaultValue: 'pending' },
      consent_given:      { type: Sequelize.BOOLEAN, defaultValue: false },
      consent_given_at:   { type: Sequelize.DATE },
      consent_given_by:   { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at:         { type: Sequelize.DATE, allowNull: false },
      updated_at:         { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('customers')
  }
}
