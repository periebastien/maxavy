'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id:             { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      email:          { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash:  { type: Sequelize.STRING, allowNull: false },
      firstname:      { type: Sequelize.STRING },
      lastname:       { type: Sequelize.STRING },
      phone:          { type: Sequelize.STRING },
      avatar_url:     { type: Sequelize.STRING },
      role:           { type: Sequelize.ENUM('superadmin', 'owner', 'member'), defaultValue: 'owner' },
      email_verified: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at:     { type: Sequelize.DATE, allowNull: false },
      updated_at:     { type: Sequelize.DATE, allowNull: false }
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users')
  }
}
