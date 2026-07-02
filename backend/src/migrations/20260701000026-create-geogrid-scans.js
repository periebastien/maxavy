'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_scans', {
      id:                    { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:           { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:           { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      keyword_id:            { type: Sequelize.UUID, allowNull: false, references: { model: 'geogrid_keywords', key: 'id' }, onDelete: 'CASCADE' },
      keyword:               { type: Sequelize.STRING, allowNull: false },
      grid_size:             { type: Sequelize.INTEGER, allowNull: false },
      grid_spacing_m:        { type: Sequelize.INTEGER, allowNull: false },
      center_lat:            { type: Sequelize.DECIMAL(10, 7) },
      center_lng:            { type: Sequelize.DECIMAL(10, 7) },
      status:                { type: Sequelize.ENUM('pending', 'running', 'done', 'failed'), defaultValue: 'pending' },
      provider:              { type: Sequelize.STRING },
      arp:                   { type: Sequelize.DECIMAL(6, 2) },
      atrp:                  { type: Sequelize.DECIMAL(6, 2) },
      solv:                  { type: Sequelize.DECIMAL(5, 2) },
      rating_snapshot:       { type: Sequelize.DECIMAL(2, 1) },
      review_count_snapshot: { type: Sequelize.INTEGER },
      points_total:          { type: Sequelize.INTEGER },
      points_ranked:         { type: Sequelize.INTEGER },
      credits_used:          { type: Sequelize.INTEGER },
      error_message:         { type: Sequelize.TEXT },
      scanned_at:            { type: Sequelize.DATE },
      created_at:            { type: Sequelize.DATE, allowNull: false },
      updated_at:            { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_scans', ['keyword_id', 'scanned_at'], { name: 'geogrid_scans_keyword_scanned_idx' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_scans')
  },
}
