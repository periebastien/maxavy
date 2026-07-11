'use strict'

const { randomUUID } = require('crypto')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('credit_packs', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      label:      { type: Sequelize.STRING, allowNull: false },
      credits:    { type: Sequelize.INTEGER, allowNull: false },
      price:      { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      active:     { type: Sequelize.BOOLEAN, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    })

    await queryInterface.bulkInsert('credit_packs', [
      { id: randomUUID(), label: 'Pack 50 crédits',  credits: 50,  price: 9,  active: true, sort_order: 0, created_at: new Date(), updated_at: new Date() },
      { id: randomUUID(), label: 'Pack 200 crédits', credits: 200, price: 29, active: true, sort_order: 1, created_at: new Date(), updated_at: new Date() },
      { id: randomUUID(), label: 'Pack 500 crédits', credits: 500, price: 59, active: true, sort_order: 2, created_at: new Date(), updated_at: new Date() },
    ])

    await queryInterface.createTable('credit_costs', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      action_key: { type: Sequelize.STRING, allowNull: false, unique: true },
      cost:       { type: Sequelize.INTEGER, allowNull: false },
      label:      { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    })

    await queryInterface.bulkInsert('credit_costs', [
      { id: randomUUID(), action_key: 'invitation_email',    cost: 1, label: 'Invitation par email',    created_at: new Date(), updated_at: new Date() },
      { id: randomUUID(), action_key: 'invitation_sms',      cost: 5, label: 'Invitation par SMS',      created_at: new Date(), updated_at: new Date() },
      { id: randomUUID(), action_key: 'invitation_whatsapp', cost: 5, label: 'Invitation par WhatsApp', created_at: new Date(), updated_at: new Date() },
      { id: randomUUID(), action_key: 'geogrid_point',       cost: 2, label: 'Geogrid — par mot-clé et par point', created_at: new Date(), updated_at: new Date() },
    ])
  },

  async down(queryInterface) {
    await queryInterface.dropTable('credit_costs')
    await queryInterface.dropTable('credit_packs')
  },
}
