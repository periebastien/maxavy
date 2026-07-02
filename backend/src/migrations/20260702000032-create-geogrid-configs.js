'use strict'

// Configuration partagée par localisation (grille + planning + rapport email) — refonte GEOGRID_REFONTE_FR.md.
// 1 config par localisation (UNIQUE location_id). Les mots-clés pointeront vers elle (config_id, migration 36).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('geogrid_configs', {
      id:                 { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      business_id:        { type: Sequelize.UUID, allowNull: false, references: { model: 'businesses', key: 'id' }, onDelete: 'CASCADE' },
      location_id:        { type: Sequelize.UUID, allowNull: false, references: { model: 'locations', key: 'id' }, onDelete: 'CASCADE' },
      center_lat:         { type: Sequelize.DECIMAL(10, 7) }, // null = centre sur la fiche (location.lat/lng)
      center_lng:         { type: Sequelize.DECIMAL(10, 7) },
      shape:              { type: Sequelize.ENUM('square', 'circle'), defaultValue: 'square' },
      grid_size:          { type: Sequelize.INTEGER, defaultValue: 7 },
      grid_spacing_m:     { type: Sequelize.INTEGER, defaultValue: 500 },
      frequency:          { type: Sequelize.ENUM('monthly', 'weekly', 'daily'), defaultValue: 'weekly' },
      run_hour:           { type: Sequelize.INTEGER, defaultValue: 4 }, // heure locale (0-23)
      run_day_of_week:    { type: Sequelize.INTEGER },  // 0 (dimanche) - 6 (samedi), pour frequency=weekly
      run_day_of_month:   { type: Sequelize.INTEGER },  // 1-31, pour frequency=monthly (clamp fin de mois côté appli)
      timezone:           { type: Sequelize.STRING },   // défaut = business.timezone si null
      next_run_at:        { type: Sequelize.DATE },      // calculé côté appli (G6), pilote le cron
      active:             { type: Sequelize.BOOLEAN, defaultValue: true },
      email_enabled:      { type: Sequelize.BOOLEAN, defaultValue: false },
      email_recipients:   { type: Sequelize.JSONB, defaultValue: [] }, // chiffré applicativement (G11, données perso)
      email_cadence:      { type: Sequelize.ENUM('per_report', 'weekly', 'monthly') },
      email_day_of_week:  { type: Sequelize.INTEGER },
      email_day_of_month: { type: Sequelize.INTEGER },
      email_hour:         { type: Sequelize.INTEGER },
      created_at:         { type: Sequelize.DATE, allowNull: false },
      updated_at:         { type: Sequelize.DATE, allowNull: false },
    })
    await queryInterface.addIndex('geogrid_configs', ['location_id'], { unique: true, name: 'geogrid_configs_location_unique' })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('geogrid_configs')
  },
}
