'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('businesses', {
      id:                   { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      owner_id:             { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      plan_id:              { type: Sequelize.UUID, references: { model: 'plans', key: 'id' }, onDelete: 'SET NULL' },
      name:                 { type: Sequelize.STRING, allowNull: false },
      slug:                 { type: Sequelize.STRING, allowNull: false, unique: true },
      website_url:          { type: Sequelize.STRING },
      country:              { type: Sequelize.STRING, defaultValue: 'FR' },
      timezone:             { type: Sequelize.STRING, defaultValue: 'Europe/Paris' },
      google_place_id:      { type: Sequelize.STRING },
      feedback_page_config: { type: Sequelize.JSONB, defaultValue: {} },
      credit_balance:       { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at:           { type: Sequelize.DATE, allowNull: false },
      updated_at:           { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('businesses')
  }
}
