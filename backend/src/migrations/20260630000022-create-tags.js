'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tags', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      name:        { type: Sequelize.STRING, allowNull: false },
      color:       { type: Sequelize.STRING },
      created_at:  { type: Sequelize.DATE, allowNull: false },
      updated_at:  { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('tags', ['business_id', 'name'], { unique: true, name: 'tags_business_name_unique' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tags')
  },
}
