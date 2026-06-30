'use strict'

// Retours privés (note ≤ 3) saisis sur la page de collecte publique.
// Non publiés : visibles seulement par le propriétaire → évite la publication d'avis négatifs.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('private_feedbacks', {
      id:           { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:  { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:  { type: Sequelize.UUID, references: { model: 'locations', key: 'id' }, onDelete: 'SET NULL' },
      rating:       { type: Sequelize.INTEGER, allowNull: false },
      comment:      { type: Sequelize.TEXT },
      author_name:  { type: Sequelize.STRING },
      author_email: { type: Sequelize.STRING },
      created_at:   { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('private_feedbacks')
  },
}
