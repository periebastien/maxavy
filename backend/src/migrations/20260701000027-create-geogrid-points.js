'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_points', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      scan_id:     { type: Sequelize.UUID, allowNull: false, references: { model: 'geogrid_scans', key: 'id' }, onDelete: 'CASCADE' },
      business_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      row:         { type: Sequelize.INTEGER, allowNull: false },
      col:         { type: Sequelize.INTEGER, allowNull: false },
      quadrant:    { type: Sequelize.ENUM('NW', 'NE', 'SW', 'SE', 'C'), allowNull: false },
      lat:         { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      lng:         { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      rank:        { type: Sequelize.INTEGER },
      competitors: { type: Sequelize.JSONB, defaultValue: [] },
      created_at:  { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_points', ['scan_id'], { name: 'geogrid_points_scan_idx' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_points')
  },
}
