require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const { OAuth2Client } = require('google-auth-library')
const { decrypt } = require('./src/config/encryption')
const GoogleConnection = require('./src/models/GoogleConnection')
const sequelize = require('./src/config/database')

async function apiFetch(client, url, label) {
  console.log(`\n▶ ${label}`)
  console.log(`  URL: ${url}`)
  try {
    const headers = await client.getRequestHeaders(url)
    const res = await fetch(url, { headers })
    const text = await res.text()
    if (!res.ok) {
      console.log(`  ✗ HTTP ${res.status}`)
      try { console.log('  ', JSON.stringify(JSON.parse(text), null, 2)) } catch { console.log('  ', text.slice(0, 500)) }
      return null
    }
    const data = JSON.parse(text)
    console.log(`  ✓ OK`)
    return data
  } catch (err) {
    console.log(`  ✗ Erreur: ${err.message}`)
    return null
  }
}

async function run() {
  await sequelize.authenticate()
  console.log('DB OK\n')

  const conn = await GoogleConnection.findOne()
  if (!conn) {
    console.log('Aucune GoogleConnection en base. Connecte ton compte Google depuis Settings.')
    process.exit(1)
  }

  console.log(`GoogleConnection trouvée — business_id: ${conn.business_id}`)
  console.log(`Email: ${conn.google_account_email || '(non enregistré)'}`)
  console.log(`Expires: ${conn.expires_at}`)
  console.log(`Last synced: ${conn.last_synced_at}`)

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_BUSINESS_REDIRECT_URI,
  )
  client.setCredentials({
    access_token:  conn.access_token  ? decrypt(conn.access_token)  : null,
    refresh_token: conn.refresh_token ? decrypt(conn.refresh_token) : null,
    expiry_date:   conn.expires_at    ? new Date(conn.expires_at).getTime() : null,
  })

  // 1. Token info
  const tokenInfo = await apiFetch(client,
    'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + decrypt(conn.access_token),
    'Token info (scopes accordés)'
  )
  if (tokenInfo) console.log('  Scopes:', tokenInfo.scope)

  // 2. Accounts
  const accounts = await apiFetch(client,
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    'My Business Account Management API — liste des comptes'
  )
  if (!accounts) { process.exit(1) }
  const accs = accounts.accounts || []
  console.log(`  ${accs.length} compte(s):`, accs.map(a => a.name).join(', '))

  if (!accs.length) {
    console.log('\n⚠ Aucun compte GBP associé à ce token. Le compte Google connecté doit être propriétaire ou gestionnaire d\'un établissement.')
    process.exit(1)
  }

  // 3. Locations via Business Information API
  for (const acc of accs) {
    const locs = await apiFetch(client,
      `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,metadata`,
      `Business Information API — localisations de ${acc.name}`
    )
    if (!locs) continue
    const locations = locs.locations || []
    console.log(`  ${locations.length} localisation(s)`)
    locations.forEach(l => console.log(`    - ${l.name} | placeId: ${l.metadata?.placeId} | title: ${l.title}`))

    // 4. Reviews v4 (legacy)
    for (const loc of locations.slice(0, 1)) {
      await apiFetch(client,
        `https://mybusiness.googleapis.com/v4/${loc.name}/reviews?pageSize=5`,
        `My Business API v4 — avis de ${loc.name}`
      )

      // 5. Reviews v4 alternative path
      await apiFetch(client,
        `https://mybusiness.googleapis.com/v4/accounts/${acc.name.split('/')[1]}/locations/${loc.name.split('/')[3]}/reviews?pageSize=5`,
        `My Business API v4 — avis (chemin alternatif)`
      )
    }
  }

  process.exit(0)
}

run().catch(err => { console.error('Fatal:', err); process.exit(1) })
