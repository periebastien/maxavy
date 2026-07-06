const { parse } = require('csv-parse/sync')
const multer = require('multer')
const Customer = require('../../models/Customer')
const Business = require('../../models/Business')
const Location = require('../../models/Location')
const { assertAccess } = require('../businesses/business.service')
const { encrypt, decrypt } = require('../../config/encryption')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Fichier CSV requis'), { status: 400 }))
    }
  },
})

async function importCsv(businessId, fileBuffer, userId, locationId) {
  const business = await Business.findByPk(businessId)
  if (!business) throw { status: 404, message: 'Entreprise introuvable' }
  await assertAccess(business, userId)

  locationId = locationId || null
  if (locationId) {
    const location = await Location.findOne({ where: { id: locationId, business_id: businessId } })
    if (!location) throw { status: 404, message: 'Localisation introuvable' }
  }

  let rows
  try {
    rows = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: [',', ';'],
      relax_column_count: true,
    })
  } catch {
    throw { status: 400, message: 'Fichier CSV invalide ou illisible' }
  }

  if (!rows.length) throw { status: 400, message: 'Le fichier CSV est vide' }

  const existing = await Customer.findAll({ where: { business_id: businessId } })
  const existingEmails = new Set(
    existing.map(c => (decrypt(c.email) || '').toLowerCase()).filter(Boolean)
  )

  const imported = []
  const errors = []
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const email = (row.email || row.Email || row.EMAIL || '').trim()
    if (!email) {
      errors.push({ row: rowNum, message: 'Email manquant' })
      continue
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ row: rowNum, message: `Email invalide : ${email}` })
      continue
    }
    if (existingEmails.has(email.toLowerCase())) {
      skipped++
      continue
    }

    const firstname = row.firstname || row.Firstname || row.FIRSTNAME || row.prenom || row.Prénom || ''
    const lastname  = row.lastname  || row.Lastname  || row.LASTNAME  || row.nom    || row.Nom    || ''
    const phone     = row.phone     || row.Phone     || row.PHONE     || row.telephone || row.Téléphone || ''

    imported.push({
      business_id:      businessId,
      location_id:      locationId,
      firstname:        firstname.trim() || null,
      lastname:         lastname.trim()  || null,
      email:            encrypt(email),
      phone:            encrypt(phone.trim()) || null,
      consent_given:    true,
      consent_given_at: new Date(),
      consent_given_by: userId,
    })

    existingEmails.add(email.toLowerCase())
  }

  if (imported.length) {
    await Customer.bulkCreate(imported)
  }

  return { imported: imported.length, skipped, errors }
}

module.exports = { upload, importCsv }
