'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_points', 'provider_task_id', { type: Sequelize.STRING })
    await queryInterface.addColumn('geogrid_points', 'fetched_at', { type: Sequelize.DATE })
    await queryInterface.addIndex('geogrid_points', ['scan_id', 'fetched_at'], { name: 'geogrid_points_scan_fetched_idx' })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_points', 'geogrid_points_scan_fetched_idx')
    await queryInterface.removeColumn('geogrid_points', 'fetched_at')
    await queryInterface.removeColumn('geogrid_points', 'provider_task_id')
  },
}
