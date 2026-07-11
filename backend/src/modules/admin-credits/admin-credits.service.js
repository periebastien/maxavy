const CreditPack = require('../../models/CreditPack')
const CreditCost = require('../../models/CreditCost')
const { invalidateCache } = require('../../services/credit-costs')

function withPricePerCredit(pack) {
  const plain = pack.toJSON ? pack.toJSON() : pack
  const pricePerCredit = plain.credits > 0
    ? Math.round((Number(plain.price) / plain.credits) * 10000) / 10000
    : null
  return { ...plain, price_per_credit: pricePerCredit }
}

async function listPacks() {
  const packs = await CreditPack.findAll({ order: [['sort_order', 'ASC']] })
  return packs.map(withPricePerCredit)
}

async function createPack({ label, credits, price, sort_order }) {
  if (!label || !credits || price == null) throw { status: 400, message: 'Champs requis manquants' }
  const pack = await CreditPack.create({ label, credits, price, sort_order: sort_order ?? 0 })
  return withPricePerCredit(pack)
}

async function updatePack(id, { label, credits, price, sort_order, active }) {
  const pack = await CreditPack.findByPk(id)
  if (!pack) throw { status: 404, message: 'Pack introuvable' }
  const fields = {}
  if (label !== undefined) fields.label = label
  if (credits !== undefined) fields.credits = credits
  if (price !== undefined) fields.price = price
  if (sort_order !== undefined) fields.sort_order = sort_order
  if (active !== undefined) fields.active = active
  await pack.update(fields)
  return withPricePerCredit(pack)
}

async function deletePack(id) {
  const pack = await CreditPack.findByPk(id)
  if (!pack) throw { status: 404, message: 'Pack introuvable' }
  await pack.update({ active: false })
  return { id: pack.id, active: false }
}

async function listCosts() {
  const costs = await CreditCost.findAll({ order: [['action_key', 'ASC']] })
  return costs.map(c => ({ action_key: c.action_key, cost: c.cost, label: c.label }))
}

async function updateCosts(costs) {
  if (!Array.isArray(costs) || !costs.length) throw { status: 400, message: 'Liste de coûts invalide' }
  for (const c of costs) {
    if (!c.action_key || typeof c.cost !== 'number' || c.cost < 0 || !Number.isInteger(c.cost)) {
      throw { status: 400, message: `Coût invalide pour ${c.action_key || '?'}` }
    }
  }
  for (const c of costs) {
    await CreditCost.update({ cost: c.cost }, { where: { action_key: c.action_key } })
  }
  invalidateCache()
  return listCosts()
}

module.exports = { listPacks, createPack, updatePack, deletePack, listCosts, updateCosts }
