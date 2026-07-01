'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('widgets', 'tag_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'tags', key: 'id' },
      onDelete: 'SET NULL',
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('widgets', 'tag_id')
  },
}
