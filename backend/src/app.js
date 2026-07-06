require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const sequelize = require('./config/database')
const { startScheduledInvitationsJob } = require('./jobs/scheduled-invitations')
const { startSyncReviewsJob } = require('./jobs/sync-reviews')
const { startScanGeogridJob } = require('./jobs/scan-geogrid')

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://locagain.com' : 'http://localhost:5173' }))

// Webhook Stripe : body brut obligatoire pour la vérification de signature HMAC.
// Doit être monté AVANT express.json() global, sinon le body arrive déjà parsé en objet JS.
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }))

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
app.use('/api/v1/google',     require('./modules/google/google.routes'))
app.use('/api/v1/campaigns', require('./modules/campaigns/campaign.routes'))
app.use('/api/v1/reviews',  require('./modules/reviews/reviews.routes'))
app.use('/api/v1/credits',  require('./modules/credits/credits.routes'))
app.use('/api/v1/stripe',   require('./modules/stripe/stripe.routes'))
app.use('/api/v1/widgets',  require('./modules/widgets/widget.routes'))
app.use('/api/v1/team',     require('./modules/team/team.routes'))
app.use('/api/v1/tags',     require('./modules/tags/tag.routes'))
app.use('/api/v1/rank-tracking', require('./modules/rank-tracking/rank-tracking.routes'))
app.use('/api/v1/admin/plans', require('./modules/plans-admin/plans-admin.routes'))
app.use('/api/v1/admin/accounts', require('./modules/admin-accounts/admin-accounts.routes'))
app.use('/api/v1/admin/business-modules', require('./modules/admin-modules/admin-modules.routes'))

const PORT = process.env.PORT || 3000

sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL connecté')
    startScheduledInvitationsJob()
    startSyncReviewsJob()
    startScanGeogridJob()
    app.listen(PORT, () => console.log(`Backend Locagain sur http://localhost:${PORT}`))
  })
  .catch(err => {
    console.error('Erreur connexion DB :', err.message)
    process.exit(1)
  })
