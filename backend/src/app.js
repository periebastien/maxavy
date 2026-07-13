require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const { jsonRateLimitHandler } = require('./middlewares/rate-limit-handler')
const sequelize = require('./config/database')
const { startScheduledInvitationsJob } = require('./jobs/scheduled-invitations')
const { startSyncReviewsJob } = require('./jobs/sync-reviews')
const { startScanGeogridJob } = require('./jobs/scan-geogrid')

const app = express()

// Derrière Apache/Passenger (reverse proxy) : sans ça, req.ip vaut l'IP du proxy pour TOUT LE MONDE →
// le rate limit ci-dessous devient un quota global au site entier au lieu d'un quota par visiteur.
// '1' = ne fait confiance qu'au premier saut (le proxy Plesk local), pas à un X-Forwarded-For arbitraire.
app.set('trust proxy', 1)

// CSP désactivée : le backend sert aussi le SPA React (Google Maps/OAuth chargés depuis des
// domaines tiers) ; la CSP par défaut de helmet casserait la page. À durcir plus tard.
// COOP en 'same-origin-allow-popups' : le COOP 'same-origin' par défaut coupe window.opener
// avec la popup Google Sign-In → « Cannot read properties of null (reading 'postMessage') ».
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}))
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://gmbmanager.ai' : 'http://localhost:5173' }))

// Webhook Stripe : body brut obligatoire pour la vérification de signature HMAC.
// Doit être monté AVANT express.json() global, sinon le body arrive déjà parsé en objet JS.
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, handler: jsonRateLimitHandler }))

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
app.use('/api/v1/admin/schedule', require('./modules/admin-schedule/admin-schedule.routes'))
app.use('/api/v1/admin/credits', require('./modules/admin-credits/admin-credits.routes'))

// --- Front statique : SPA React buildé et déposé dans backend/public ---
// Sert les fichiers du build, puis renvoie index.html pour toute route non-API
// (routing côté client React Router).
const path = require('path')
const clientDir = path.join(__dirname, '../public')
app.use(express.static(clientDir))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(clientDir, 'index.html'))
})

const PORT = process.env.PORT || 3000

// Garde-fou anti-double-cron : sous Passenger (ou PM2) plusieurs instances du process peuvent
// démarrer. On acquiert un verrou consultatif Postgres (niveau session) sur une connexion dédiée
// jamais relâchée : une seule instance l'obtient et lance donc les crons. Les autres s'abstiennent.
async function startCronsIfPrimary() {
  const conn = await sequelize.connectionManager.getConnection()
  const res = await conn.query('SELECT pg_try_advisory_lock(4021957) AS locked')
  const locked = res.rows[0].locked
  if (!locked) {
    sequelize.connectionManager.releaseConnection(conn)
    console.log('[cron] verrou déjà détenu par une autre instance — jobs non démarrés')
    return
  }
  // Connexion volontairement NON relâchée : le verrou de session persiste tant que le process vit.
  console.log('[cron] instance primaire — jobs démarrés')
  startScheduledInvitationsJob()
  startSyncReviewsJob()
  startScanGeogridJob()
}

sequelize.authenticate()
  .then(async () => {
    console.log('PostgreSQL connecté')
    // L'échec du verrou cron ne doit jamais empêcher le serveur de démarrer.
    try {
      await startCronsIfPrimary()
    } catch (e) {
      console.error('[cron] échec acquisition du verrou (jobs non démarrés) :', e.message)
    }
    app.listen(PORT, () => console.log(`Backend GMB Manager démarré sur le port ${PORT}`))
  })
  .catch(err => {
    console.error('Erreur connexion DB :', err.message)
    process.exit(1)
  })
