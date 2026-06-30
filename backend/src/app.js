require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const sequelize = require('./config/database')

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://locagain.com' : 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }))

app.use('/api/v1/auth',       require('./modules/auth/auth.routes'))
app.use('/api/v1/businesses', require('./modules/businesses/business.routes'))
app.use('/api/v1/locations',  require('./modules/locations/location.routes'))
app.use('/api/v1/places',    require('./modules/places/places.routes'))
app.use('/api/v1/public',     require('./modules/public/public.routes'))
app.use('/api/v1/customers',    require('./modules/customers/customer.routes'))
app.use('/api/v1/invitations', require('./modules/invitations/invitation.routes'))

const PORT = process.env.PORT || 3000

sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL connecté')
    app.listen(PORT, () => console.log(`Backend Locagain sur http://localhost:${PORT}`))
  })
  .catch(err => {
    console.error('Erreur connexion DB :', err.message)
    process.exit(1)
  })
