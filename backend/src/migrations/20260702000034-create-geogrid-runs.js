'use strict'

// Un « rapport » = 1 exécution (manuelle ou planifiée) qui scanne tous les mots-clés actifs d'une config
// en une fois. GEOGRID_REFONTE_FR.md §1, §3.1, §7. has_failures : run "done" mais avec des scans en échec
// (§16) — l'email (G11) part quand même, en le mentionnant.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_runs', {
      id:             { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:    { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:    { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      config_id:      { type: Sequelize.UUID, allowNull: false, references: { model: 'geogrid_configs', key: 'id' }, onDelete: 'CASCADE' },
      trigger:        { type: Sequelize.ENUM('manual', 'scheduled'), allowNull: false },
      status:         { type: Sequelize.ENUM('pending', 'running', 'done', 'failed'), defaultValue: 'pending' },
      has_failures:   { type: Sequelize.BOOLEAN, defaultValue: false },
      scheduled_for:  { type: Sequelize.DATE },
      started_at:     { type: Sequelize.DATE },
      finished_at:    { type: Sequelize.DATE },
      keywords_total: { type: Sequelize.INTEGER, defaultValue: 0 },
      keywords_done:  { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at:     { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_runs', ['config_id', 'created_at'], { name: 'geogrid_runs_config_created_idx' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_runs')
  },
}
