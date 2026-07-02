'use strict'

const { v4: uuidv4 } = require('uuid')

// Données existantes (sessions G1→G4) : chaque mot-clé portait sa propre grille/fréquence. On crée 1
// geogrid_config par localisation ayant des mots-clés, en reprenant les valeurs du mot-clé le plus
// récent de cette localisation (déterministe, cf. GEOGRID_REFONTE_FR.md §3.3), puis on rattache tous
// les mots-clés de la localisation à cette config. Le centre reste null (= centré sur la fiche, comme
// aujourd'hui) ; le fuseau reprend celui de l'entreprise (défaut Europe/Paris si absent).

module.exports = {
  async up(queryInterface) {
    const [keywordRows] = await queryInterface.sequelize.query(
      `SELECT id, business_id, location_id, grid_size, grid_spacing_m, frequency, created_at
       FROM geogrid_keywords ORDER BY location_id, created_at DESC`
    )
    if (!keywordRows.length) return

    const [businessRows] = await queryInterface.sequelize.query(`SELECT id, timezone FROM businesses`)
    const tzByBusiness = new Map(businessRows.map(b => [b.id, b.timezone || 'Europe/Paris']))

    const byLocation = new Map()
    for (const kw of keywordRows) {
      if (!byLocation.has(kw.location_id)) byLocation.set(kw.location_id, kw) // 1er = le + récent (ORDER BY ... DESC)
    }

    const now = new Date()
    const configs = [...byLocation.entries()].map(([locationId, kw]) => ({
      id: uuidv4(),
      business_id: kw.business_id,
      location_id: locationId,
      shape: 'square',
      grid_size: kw.grid_size,
      grid_spacing_m: kw.grid_spacing_m,
      frequency: kw.frequency,
      run_hour: 4,
      timezone: tzByBusiness.get(kw.business_id) || 'Europe/Paris',
      active: true,
      email_enabled: false,
      email_recipients: JSON.stringify([]),
      created_at: now,
      updated_at: now,
    }))

    await queryInterface.bulkInsert('geogrid_configs', configs)

    for (const cfg of configs) {
      await queryInterface.sequelize.query(
        'UPDATE geogrid_keywords SET config_id = :configId WHERE location_id = :locationId',
        { replacements: { configId: cfg.id, locationId: cfg.location_id } }
      )
    }
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('UPDATE geogrid_keywords SET config_id = NULL')
    await queryInterface.bulkDelete('geogrid_configs', null, {})
  },
}
