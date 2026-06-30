'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invitations', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      customer_id: { type: Sequelize.UUID, references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE' },
      business_id: { type: Sequelize.UUID, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      channel:     { type: Sequelize.ENUM('email', 'sms', 'whatsapp'), defaultValue: 'email' },
      sent_at:     { type: Sequelize.DATE },
      status:      { type: Sequelize.ENUM('pending', 'sent', 'failed'), defaultValue: 'pending' },
      created_at:  { type: Sequelize.DATE, allowNull: false }
    })

    await queryInterface.createTable('widgets', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id: { type: Sequelize.UUID, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      name:        { type: Sequelize.STRING },
      type:        { type: Sequelize.ENUM('carousel', 'badge'), defaultValue: 'carousel' },
      config:      { type: Sequelize.JSONB, defaultValue: {} },
      embed_code:  { type: Sequelize.TEXT },
      created_at:  { type: Sequelize.DATE, allowNull: false },
      updated_at:  { type: Sequelize.DATE, allowNull: false }
    })

    await queryInterface.createTable('credits', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id: { type: Sequelize.UUID, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      amount:      { type: Sequelize.INTEGER, allowNull: false },
      action_type: { type: Sequelize.STRING },
      source:      { type: Sequelize.ENUM('plan', 'purchase', 'bonus'), defaultValue: 'plan' },
      created_at:  { type: Sequelize.DATE, allowNull: false }
    })

    await queryInterface.createTable('subscriptions', {
      id:                     { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:            { type: Sequelize.UUID, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      stripe_subscription_id: { type: Sequelize.STRING },
      plan_id:                { type: Sequelize.UUID, references: { model: 'plans', key: 'id' }, onDelete: 'SET NULL' },
      status:                 { type: Sequelize.STRING },
      renewal_date:           { type: Sequelize.DATE },
      created_at:             { type: Sequelize.DATE, allowNull: false },
      updated_at:             { type: Sequelize.DATE, allowNull: false }
    })

    await queryInterface.createTable('team_members', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id: { type: Sequelize.UUID, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      user_id:     { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      role:        { type: Sequelize.ENUM('admin', 'editor', 'viewer'), defaultValue: 'viewer' },
      invited_at:  { type: Sequelize.DATE },
      accepted_at: { type: Sequelize.DATE },
      created_at:  { type: Sequelize.DATE, allowNull: false }
    })

    await queryInterface.createTable('business_modules', {
      id:           { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:  { type: Sequelize.UUID, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      module_key:   { type: Sequelize.STRING, allowNull: false },
      enabled:      { type: Sequelize.BOOLEAN, defaultValue: false },
      activated_at: { type: Sequelize.DATE },
      settings:     { type: Sequelize.JSONB, defaultValue: {} },
      created_at:   { type: Sequelize.DATE, allowNull: false }
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('business_modules')
    await queryInterface.dropTable('team_members')
    await queryInterface.dropTable('subscriptions')
    await queryInterface.dropTable('credits')
    await queryInterface.dropTable('widgets')
    await queryInterface.dropTable('invitations')
  }
}
