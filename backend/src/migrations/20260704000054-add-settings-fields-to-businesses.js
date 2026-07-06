'use strict'

// Session 29 — Paramètres entreprise : logo, coordonnées, préférences de notifications.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('businesses', 'logo_url', {
      type: Sequelize.STRING, allowNull: true,
    })
    await queryInterface.addColumn('businesses', 'contact_email', {
      type: Sequelize.STRING, allowNull: true,
    })
    await queryInterface.addColumn('businesses', 'contact_phone', {
      type: Sequelize.STRING, allowNull: true,
    })
    await queryInterface.addColumn('businesses', 'address', {
      type: Sequelize.STRING, allowNull: true,
    })
    await queryInterface.addColumn('businesses', 'notification_prefs', {
      type: Sequelize.JSONB, allowNull: false, defaultValue: {},
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('businesses', 'notification_prefs')
    await queryInterface.removeColumn('businesses', 'address')
    await queryInterface.removeColumn('businesses', 'contact_phone')
    await queryInterface.removeColumn('businesses', 'contact_email')
    await queryInterface.removeColumn('businesses', 'logo_url')
  },
}
