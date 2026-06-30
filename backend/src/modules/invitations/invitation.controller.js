const service = require('./invitation.service')

async function send(req, res) {
  try {
    const { customer_id, channel, location_id, business_id } = req.body
    if (!customer_id || !channel || !location_id || !business_id) {
      return res.status(400).json({ message: 'customer_id, channel, location_id et business_id sont requis' })
    }
    const invitation = await service.send({
      customerId:  customer_id,
      channel,
      locationId:  location_id,
      businessId:  business_id,
      userId:      req.user.id,
    })
    res.status(201).json(invitation)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
}

module.exports = { send }
