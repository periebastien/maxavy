'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('review_tags', {
      review_id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, references: { model: 'reviews', key: 'id' }, onDelete: 'CASCADE' },
      tag_id:    { type: Sequelize.UUID, allowNull: false, primaryKey: true, references: { model: 'tags', key: 'id' }, onDelete: 'CASCADE' },
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('review_tags')
  },
}
