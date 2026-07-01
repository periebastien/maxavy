// Utilitaire de données de test — avis factices pour tester les widgets/surveillance
// tant que la synchro Google Business Profile n'est pas active (quota GMB bloqué).
//
//   node scripts/test-reviews.js add     → insère 3 avis de test sur la localisation Marrakech
//   node scripts/test-reviews.js clear   → supprime TOUS les avis de test (external_id « seed-% »)
//
// Les avis de test sont identifiés par leur external_id préfixé « seed- » : le clear
// ne touche jamais aux vrais avis Google.

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const crypto = require('crypto')
const sequelize = require('../src/config/database')

const SEED = [
  { ext: 'seed-marrakech-1', author: 'Sophie Lambert', rating: 5, text: 'Accueil parfait et équipe très professionnelle. Ils nous ont accompagnés tout au long de notre achat à Marrakech, avec beaucoup de patience et de conseils avisés. Je recommande vivement.', date: '2026-06-18' },
  { ext: 'seed-marrakech-2', author: 'Karim El Fassi', rating: 4, text: 'Bonne agence, réactive et sérieuse. Quelques délais administratifs mais rien d\'anormal pour ce type de transaction.', date: '2026-05-30' },
  { ext: 'seed-marrakech-3', author: 'Marie Dubois', rating: 5, text: 'Service impeccable du début à la fin. Agents disponibles, transparents sur les prix, et très bonne connaissance du marché local.', date: '2026-05-02' },
]

async function add() {
  const [locs] = await sequelize.query("SELECT id, business_id FROM locations WHERE address ILIKE '%Marrakech%' ORDER BY created_at ASC LIMIT 1")
  const loc = locs[0]
  if (!loc) { console.error('Aucune localisation « Marrakech » trouvée.'); return }
  for (const r of SEED) {
    await sequelize.query(
      "INSERT INTO reviews (id,business_id,location_id,platform,external_id,author_name,rating,text,published_at,replied,created_at) VALUES (:id,:biz,:loc,'google',:ext,:name,:rating,:text,:pub,false,NOW()) ON CONFLICT DO NOTHING",
      { replacements: { id: crypto.randomUUID(), biz: loc.business_id, loc: loc.id, ext: r.ext, name: r.author, rating: r.rating, text: r.text, pub: r.date } }
    )
  }
  const [[{ count }]] = await sequelize.query("SELECT count(*)::int FROM reviews WHERE external_id LIKE 'seed-%'")
  console.log(`✓ Avis de test présents : ${count}`)
}

async function clear() {
  const [res] = await sequelize.query("DELETE FROM reviews WHERE external_id LIKE 'seed-%'")
  console.log('✓ Avis de test supprimés.')
}

const cmd = process.argv[2]
;(async () => {
  if (cmd === 'add') await add()
  else if (cmd === 'clear') await clear()
  else { console.log('Usage : node scripts/test-reviews.js add|clear'); process.exit(1) }
  process.exit(0)
})().catch(e => { console.error('ERREUR:', e.message); process.exit(1) })
