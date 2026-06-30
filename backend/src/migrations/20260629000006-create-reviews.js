'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reviews', {
      id:           { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:  { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:  { type: Sequelize.UUID, references: { model: 'locations', key: 'id' }, onDelete: 'SET NULL' },
      platform:     { type: Sequelize.STRING, defaultValue: 'google' },
      external_id:  { type: Sequelize.STRING },
      author_name:  { type: Sequelize.STRING },
      rating:       { type: Sequelize.INTEGER },
      text:         { type: Sequelize.TEXT },
      sentiment:    { type: Sequelize.STRING },
      published_at: { type: Sequelize.DATE },
      replied:      { type: Sequelize.BOOLEAN, defaultValue: false },
      reply_text:   { type: Sequelize.TEXT },
      created_at:   { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('reviews')
  }
}
