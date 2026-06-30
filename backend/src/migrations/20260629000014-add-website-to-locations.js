'use strict'
// website_url : site web de la fiche Google de la localisation (récupéré via Places `websiteURI`).
// Sert à dériver le favicon du site comme logo de la localisation (fallback : initiale du nom).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('locations', 'website_url', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('locations', 'website_url')
  },
}
