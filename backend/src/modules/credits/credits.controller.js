const service = require('./credits.service')

async function balance(req, res) {
  try {
    const result = await service.getBalance(req.query.business_id, req.user.id)
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function history(req, res) {
  try {
    const { business_id, page, limit } = req.query
    const result = await service.getHistory(business_id, req.user.id, {
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
    })
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

async function add(req, res) {
  try {
    const owner = await service.addCredits(req.query.business_id, req.user.id, req.body)
    res.json({ credit_balance: owner.credit_balance })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { balance, history, add }
