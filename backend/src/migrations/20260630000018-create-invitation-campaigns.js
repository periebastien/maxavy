'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invitation_campaigns', {
      id:           { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:  { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:  { type: Sequelize.UUID, allowNull: true, references: { model: 'locations', key: 'id' }, onDelete: 'SET NULL' },
      name:         { type: Sequelize.STRING, allowNull: false },
      channel:      { type: Sequelize.ENUM('email', 'sms', 'whatsapp'), defaultValue: 'email' },
      rate_per_day: { type: Sequelize.INTEGER, allowNull: true },
      rate_per_week:{ type: Sequelize.INTEGER, allowNull: true },
      total_count:  { type: Sequelize.INTEGER, defaultValue: 0 },
      sent_count:   { type: Sequelize.INTEGER, defaultValue: 0 },
      failed_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      status:       { type: Sequelize.ENUM('running', 'paused', 'completed', 'cancelled'), defaultValue: 'running' },
      created_at:   { type: Sequelize.DATE, allowNull: false },
      updated_at:   { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.addColumn('invitations', 'campaign_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'invitation_campaigns', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addColumn('invitations', 'scheduled_at', {
      type: Sequelize.DATE,
      allowNull: true,
    })
    await queryInterface.addColumn('invitations', 'location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invitations', 'location_id')
    await queryInterface.removeColumn('invitations', 'scheduled_at')
    await queryInterface.removeColumn('invitations', 'campaign_id')
    await queryInterface.dropTable('invitation_campaigns')
  },
}
