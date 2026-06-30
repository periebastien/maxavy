'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('google_connections', {
      id:            { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:   { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      access_token:  { type: Sequelize.TEXT },
      refresh_token: { type: Sequelize.TEXT },
      scopes:        { type: Sequelize.TEXT },
      expires_at:    { type: Sequelize.DATE },
      last_synced_at:{ type: Sequelize.DATE },
      created_at:    { type: Sequelize.DATE, allowNull: false },
      updated_at:    { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('google_connections')
  }
}
