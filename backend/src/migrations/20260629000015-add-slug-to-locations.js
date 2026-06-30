'use strict'

// Slug par localisation → URL publique /avis/[slug-entreprise]/[slug-localisation].
// Unique au sein d'une même entreprise (deux entreprises peuvent réutiliser le même slug de localisation).
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('locations', 'slug', { type: Sequelize.STRING, allowNull: true })

    // Backfill : génère un slug unique par entreprise pour les localisations déjà en base.
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, business_id, name FROM locations ORDER BY created_at ASC'
    )
    const usedByBiz = {}
    for (const row of rows) {
      const base = slugify(row.name) || 'localisation'
      const used = usedByBiz[row.business_id] || (usedByBiz[row.business_id] = new Set())
      let slug = base
      let i = 1
      while (used.has(slug)) slug = `${base}-${++i}`
      used.add(slug)
      await queryInterface.sequelize.query(
        'UPDATE locations SET slug = :slug WHERE id = :id',
        { replacements: { slug, id: row.id } }
      )
    }

    // Toutes les lignes ont désormais un slug → on peut imposer l'unicité (business_id, slug).
    await queryInterface.addIndex('locations', ['business_id', 'slug'], {
      unique: true,
      name: 'locations_business_slug_unique',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('locations', 'locations_business_slug_unique')
    await queryInterface.removeColumn('locations', 'slug')
  },
}
