'use strict'

// Rattache chaque mot-clé à la config partagée de sa localisation. Nullable pour l'instant : peuplé pour
// l'historique par la migration 38 (data). onDelete SET NULL — la suppression d'une config ne doit pas
// supprimer les mots-clés (la localisation, elle, cascade déjà via location_id).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('geogrid_keywords', 'config_id', {
      type: Sequelize.UUID,
      references: { model: 'geogrid_configs', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addIndex('geogrid_keywords', ['config_id'], { name: 'geogrid_keywords_config_idx' })
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('geogrid_keywords', 'geogrid_keywords_config_idx')
    await queryInterface.removeColumn('geogrid_keywords', 'config_id')
  },
}
