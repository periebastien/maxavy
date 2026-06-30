'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'google_id', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    })
    await queryInterface.addColumn('users', 'auth_provider', {
      type: Sequelize.ENUM('local', 'google'),
      defaultValue: 'local',
      allowNull: false,
    })
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'google_id')
    await queryInterface.removeColumn('users', 'auth_provider')
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: false,
    })
  },
}
