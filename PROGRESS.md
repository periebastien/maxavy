# PROGRESS — Locagain MVP
> Dernière mise à jour : 2026-06-30 (session 19)
> Backend : `node src/app.js` depuis `backend/` → http://localhost:3000
> Frontend : `npm run dev` depuis `frontend/` → http://localhost:5173

---

## PHASE 1 — FONDATIONS

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 1 | Init projet | ✅ Terminé | Structure créée, dépendances installées |
| 2 | Config backend | ✅ Terminé | Express + Sequelize + PostgreSQL + migrations |
| 3 | Config frontend | ✅ Terminé | Vite + React + Tailwind (palette Qwairy) |
| 4 | Composants de base | ✅ Terminé | Button, Card, Badge, MetricCard, Input, Select, Sidebar, TopBar, AppLayout |
| 5 | Sécurité fondations | ✅ Terminé | Helper AES-256-GCM, Helmet.js, rate limiting, 10 migrations en base |

## PHASE 2 — AUTHENTIFICATION

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 6 | Backend auth | ✅ Terminé | POST /register, POST /login, GET /me, JWT + bcrypt, middleware auth |
| 7 | Frontend auth | ✅ Terminé | Login/Register + Google OAuth (@react-oauth/google), AuthContext |
| 8 | Mot de passe oublié | ✅ Terminé | JWT reset token 1h, pages ForgotPassword + ResetPassword |

## PHASE 3 — ENTREPRISES & LAYOUT

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 9 | Backend entreprises | ✅ Terminé | Models Business/TeamMember, CRUD API, slug auto |
| 10 | Frontend entreprises | ✅ Terminé | BusinessContext, RequireBusiness guard, Sidebar avec BusinessSelector |
| 11 | Layout + Dashboard + Settings + Onboarding GMB | ✅ Terminé (partiellement refondu en 11b) | Voir détail ci-dessous |
| 11b | Module Localisations + refonte Google Places | ✅ Terminé | Google déplacé au niveau **localisation**. Onboarding en wizard entreprise → 1ère localisation. Voir détail ci-dessous |
| 11c | Refonte navigation (3 sélecteurs) + logos | ✅ Terminé | **Localisation active** (haut sidebar), **Entreprise** (topbar droite), **Compte** (bas sidebar). Avatars favicon. Voir détail ci-dessous |
| 11d | Avatar user (Gravatar) + CRUD entreprise + correctifs | ✅ Terminé | Suppression entreprise (cascade locations), Gravatar compte, fix 204/JSON + dropdown PlaceSearch. Voir détail ci-dessous |

### Détail session 11 (grosse session)

**Onboarding** — refait en flux GMB-first :
- Étape 1 : `PlaceSearch` → `Place.fetchFields()` → auto-fill nom/pays/timezone/site
- Étape 2 : confirmation + édition + création
- Mode manuel disponible (3 étapes) si pas de fiche Google
- Envoie et sauvegarde `google_place_id` + `google_place_name` (bug corrigé : `create()` ignorait ces champs)

**Dashboard** (`/dashboard`) :
- `credit_balance` réel affiché
- Checklist "Premiers pas"
- Card infos établissement
- Bannière warning si GMB non connecté

**Settings** (`/settings`) :
- Section "Informations générales" (PATCH au save)
- Section "Google My Business" : `PlaceSearch` pour connecter/changer, bouton déconnecter

**Composant `PlaceSearch`** (partagé) :
- `@googlemaps/js-api-loader` v2.x → `setOptions()` + `importLibrary('places')` + `AutocompleteService`
- Prop `country=''` par défaut = recherche mondiale (pas de restriction)
- ⚠️ La classe `Loader` n'existe plus dans v2.x — ne jamais l'utiliser

### Détail session 11b — Google Places déplacé au niveau localisation (2026-06-30)

**Pourquoi** : une entreprise (chaîne) peut avoir plusieurs établissements, chacun avec sa propre fiche Google et ses propres avis. Les données Google Places ne sont donc plus portées par l'**entreprise** mais par la **localisation**.

**Décisions produit actées** :
- Une entreprise doit avoir **au moins une localisation** (le wizard d'onboarding la crée).
- Une localisation a **obligatoirement** une fiche Google (`google_place_id` requis).
- Onboarding **entreprise = 100 % manuel** (plus de pré-remplissage Google au niveau entreprise).
- Projet en dev → **repart à zéro**, pas de migration de données (backfill).
- L'OAuth Google (`google_connections`) **reste au niveau entreprise** pour le MVP (1 compte Google = N fiches). À réévaluer en phase 6.

**Backend** :
- Modèle `Location.js` (+ `google_place_id` requis, `google_place_name`).
- Module `modules/locations/` : `POST/GET/GET:id/PATCH/DELETE /api/v1/locations` (monté dans `app.js`).
- Isolation multi-tenant : `assertAccess` (exporté depuis `business.service`) vérifie l'appartenance du business à chaque opération.
- Validation : `name` requis, `google_place_id` requis, bornes `lat`/`lng`.
- `business.service` ne gère plus Google (create + whitelist update nettoyés) ; champs retirés du modèle `Business`.
- Migration `11` : `locations.google_place_name`. Migration `12` : drop `businesses.google_place_id`/`google_place_name`. Migration `13` : `locations.google_place_id` NOT NULL (aligne la contrainte DB sur l'invariante produit).
- ✅ **Migrations 11, 12, 13 & 14 appliquées** (`npx sequelize-cli db:migrate` depuis `backend/`).

**Frontend** :
- `OnboardingPage` réécrit en **wizard 3 étapes** : entreprise (manuel) → première localisation (PlaceSearch obligatoire + `fetchFields` nom/adresse/lat/lng) → confirmation. Crée le business puis la location (robuste si l'étape location échoue : retente sans recréer le business).
- `LocationContext` (charge les localisations du business actif) + `LocationsPage` (`/locations`, liste + CRUD via PlaceSearch).
- `Sidebar` : entrée « Localisations » (compteur live). `App.jsx` : route `/locations`. `main.jsx` : `LocationProvider`.
- `SettingsPage` : section GMB entreprise retirée → renvoi vers `/locations`.
- `DashboardPage` : `hasGMB` (entreprise) → `hasLocations` (contexte) ; bannière/checklist/infos adaptées.

### Détail session 11c — Refonte navigation (3 sélecteurs de contexte) + logos (2026-06-30)

**Convention des 3 sélecteurs** (voir cahier §8.4 « Hiérarchie des trois sélecteurs de contexte ») :
- **Haut de sidebar** = sélecteur de **localisation active** (nom + adresse + logo) — périmètre de travail courant.
- **Topbar à droite** = sélecteur d'**entreprise** active (tenant).
- **Bas de sidebar** = **compte utilisateur** (menu déroulant : sous-menu compte « bientôt » + déconnexion).

**Frontend** :
- `LocationContext` : ajoute `activeLocation` + `setActiveLocation` (mémorisé par business dans `localStorage`, clé `active_location_id:<businessId>`, fallback = 1ʳᵉ localisation).
- `Sidebar` : `LocationSelector` (haut) + `AccountMenu` (bas) ; l'ancien sélecteur d'entreprise quitte la sidebar.
- `TopBar` : `BusinessSelector` à droite (vrai sélecteur, plus un simple affichage) ; « Ajouter une entreprise » → `/onboarding`.
- `AppLayout` : ne passe plus `business` à `TopBar` (qui lit le contexte directement).
- Nouveaux utilitaires : `lib/useClickOutside.js`, `lib/favicon.js` (favicon Google s2 depuis le site), `components/common/EntityAvatar.jsx` (logo → fallback initiale).
- Avatars favicon câblés : sélecteur localisation, sélecteur entreprise, carte entreprise du Dashboard, liste des localisations.

**Backend** :
- Migration `14` : `locations.website_url` (site de la fiche Google). Modèle + service (`create` + whitelist `update`) mis à jour.
- Onboarding & `LocationsPage` : `fetchFields` récupère désormais `websiteURI` → stocké en `website_url` (source du favicon).

**Vérifs** : `node --check` backend OK, `vite build` OK (1817 modules).

**Reste à faire** (quand les modules avis/QR/invitations arriveront) : consommer `activeLocation` comme filtre de portée ; griser le sélecteur de localisation sur les pages niveau entreprise (Paramètres, Facturation).

### Détail session 11d — Avatar utilisateur + CRUD entreprise + correctifs UX (2026-06-30)

**Frontend** :
- `lib/gravatar.js` : URL Gravatar via SHA-256 (Web Crypto, sans dépendance), `d=404` → `EntityAvatar` retombe sur l'initiale si pas de Gravatar. Câblé dans `AccountMenu` (bas sidebar).
- `TopBar.BusinessSelector` : chaque entreprise a au survol **Modifier** (→ active + `/settings`) et **Supprimer** (confirm → `DELETE` → si plus aucune entreprise, `/onboarding`).

**Backend** :
- `DELETE /api/v1/businesses/:id` : `business.service.remove()` (propriétaire only) supprime d'abord les `locations` liées (pas de FK cascade en base) puis l'entreprise. Route + controller `destroy` ajoutés.

**Correctifs** :
- `lib/api.js` : `if (res.status === 204) return null` avant `res.json()` → corrige « Unexpected end of JSON input » à la suppression d'une localisation/entreprise.
- `PlaceSearch.jsx` : flag `justSelectedRef` → le dropdown de propositions ne se rouvre plus après sélection (il masquait les boutons Enregistrer/Annuler).

**Vérifs** : `node --check` backend OK, `vite build` OK (1818 modules).

## PHASE 4 — DASHBOARD & COLLECTE

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 12 | Dashboard | ✅ Terminé | KPIs, checklist, carte établissement (DashboardPage.jsx) |
| 13 | Page collecte publique | ✅ Terminé | Route `/avis/[entreprise]/[localisation]`, étoiles, ≥4→Google, ≤3→feedback privé. Voir détail ci-dessous |
| 14 | Réglages page collecte | ✅ Terminé | Mode smart/direct, branding, textes, seuil Google, SEO → `feedback_page_config` JSON. Voir détail ci-dessous |
| 15 | QR Code | ✅ Terminé | PNG (1024px) + SVG téléchargeables, logo centré si configuré, copie URL, sélecteur localisation. Voir détail ci-dessous |

### Détail session 13 — Page de collecte publique (2026-06-30)

**Décision URL** (architecture per-location depuis 11b) : `/avis/[slug-entreprise]/[slug-localisation]`. Chaque localisation a son slug → sa page et (session 15) son QR pointent vers **sa** fiche Google.

**Backend** :
- Migration `15` : `locations.slug` + **backfill** des localisations existantes (slug unique par entreprise) + index unique `(business_id, slug)`.
- Migration `16` : table `private_feedbacks` (`business_id`, `location_id`, `rating`, `comment`, `author_name`, `author_email`, `created_at`).
- `Location` : champ `slug` (généré à la création, unique par entreprise ; **immuable via l'API** pour ne pas casser les QR). Modèle `PrivateFeedback`.
- **Module `public/` — routes SANS auth** (montées sur `/api/v1/public`) :
  - `GET /collect/:businessSlug/:locationSlug` → payload public curé (jamais owner_id/crédits).
  - `POST /collect/:businessSlug/:locationSlug/feedback` → enregistre le retour (note ≤ 3). `business_id`/`location_id` résolus côté serveur (anti-injection). Limiteur dédié 20/15 min.

**Frontend** :
- `pages/CollectPage.jsx` (lazy, hors `PrivateRoute`) : étoiles → **note ≥ 4** : CTA « Laisser un avis sur Google » (`googleReviewUrl(google_place_id)`) ; **note ≤ 3** : formulaire privé (commentaire requis, nom/email facultatifs) → POST → écran de remerciement. Mobile-first.
- `lib/googleReview.js` (`https://search.google.com/local/writereview?placeid=…`).
- Lecture défensive de `feedback_page_config` (clés snake_case `branding.primary_color`, `branding.logo_url`, `rating.welcome_text`…) avec valeurs par défaut → **la session 14 remplira ce JSON**.
- Route `/avis/:businessSlug/:locationSlug` ajoutée dans `App.jsx`.

**Tests réels** : `GET` renvoie le payload, `POST` enregistre (vérifié en base puis nettoyé), rating hors bornes → 400. `node --check` OK, `vite build` OK (1820 modules).

### Détail session 14 — Réglages page de collecte (2026-06-30)

**Page admin** `/parametres-page-collecte` (`CollectSettingsPage.jsx`) — accessible depuis la sidebar (section COLLECTE, icône Globe).

**Sections** :
- **Mode** : `smart` (page intelligente avec filtre étoiles, défaut) vs `direct` (redirection immédiate vers Google sans filtre). Avertissement explicite sur la perte du filtre anti-avis-négatifs en mode direct.
- **Apparence** : URL de logo (champ texte — upload à faire quand le stockage OVH sera en place, noté dans le cahier §4), color picker natif + champ hex pour la couleur principale, toggle "Propulsé par Locagain" (réservé plans payants).
- **Textes** (mode smart seulement) : titre, sous-titre, message avis positif, message avis négatif.
- **Redirection Google** (mode smart seulement) : seuil 3/4/5 étoiles (défaut 4) — en dessous, le retour reste privé.
- **SEO** : titre et description méta pour la page publique.

**Bouton Aperçu** (en-tête + bas de formulaire) → ouvre `/avis/[slug-entreprise]/[slug-localisation]` dans un nouvel onglet. Visible uniquement si une localisation active est sélectionnée.

**Backend** : aucune modification — `PATCH /api/v1/businesses/:id` acceptait déjà `feedback_page_config` dans la whitelist (session 11d).

**CollectPage mis à jour** :
- `readConfig` ajoute `mode` et `threshold` dans son retour.
- Nouveau `useEffect` : si `mode === 'direct'` et `google_place_id` présent → `window.location.replace(googleReviewUrl(...))` immédiatement après le chargement (le spinner reste visible le temps de la redirection).
- `pickRating` lit le seuil depuis `data.business.feedback_page_config.rating.threshold` (défaut 4) pour découpler la décision positive/négative du hard-code.

**Vérifs** : `vite build` OK (1821 modules transformés).

### Détail session 15 — QR Code (2026-06-30)

**Page** `/qrcode` (`QRCodePage.jsx`) — accessible depuis la sidebar (section COLLECTE, icône QrCode, déjà câblée).

**Fonctionnement** :
- URL encodée : `window.location.origin + /avis/[slug-entreprise]/[slug-localisation]` → automatiquement juste en dev et en prod.
- Sélecteur de localisation affiché uniquement si l'entreprise a ≥ 2 localisations.
- Logo centré dans le QR si `feedback_page_config.branding.logo_url` est renseigné (configurable depuis `/parametres-page-collecte`).
- **Téléchargement PNG** : essaie le canvas d'affichage (avec logo) ; si CORS taint → utilise le canvas de secours 1024 px sans logo.
- **Téléchargement SVG** : canvas caché `QRCodeSVG` 1024 px, sérialisé via `XMLSerializer` → Blob → download.
- **Copie URL** : `navigator.clipboard.writeText`, icône ✓ 2 s.
- Note permanence du slug : slug de localisation immuable via l'API → QR imprimés/distribués jamais invalidés.

**Librairie** : `qrcode.react` (installée, 1823 modules transformés). Niveau de correction : `H` (30 % de redondance, permet logo centré sans perdre la lisibilité).

**Vérifs** : `vite build` OK (1823 modules).

## PHASE 5 — CLIENTS & INVITATIONS

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 16 | Backend clients | ✅ Terminé | CRUD customers, chiffrement AES-256-GCM email/tel, consentement horodaté (consent_given_at/by), isolation multi-tenant |
| 17 | Import CSV | ✅ Terminé | multer + csv-parse, dédup par email, consentement bloquant, réponse {imported, skipped, errors} |
| 18 | Frontend clients | ✅ Terminé | Liste table, ajout individuel, import CSV drag & drop + modèle téléchargeable, api.upload() |
| 19 | Invitations | ✅ Terminé | Email Brevo (template HTML, lien collecte), décrémentation credit_balance + historique credits, statut customer → invited. SMS stub (Twilio trial sans numéro). |

## PHASE 6 — AVIS GOOGLE

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 20 | OAuth Google Business Profile | ⬜ À faire | Token chiffré AES-256-GCM |
| 21 | Sync avis | ⬜ À faire | Cron quotidien, table reviews |
| 22 | Interface avis | ⬜ À faire | Liste, filtres, réponse |

## PHASE 7 — CRÉDITS & STRIPE

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 23 | Backend crédits | ⬜ À faire | Table credits, middleware checkCredits |
| 24 | Stripe abonnements | ⬜ À faire | Plans Gratuit/Starter/Pro, webhooks |
| 25 | Achat crédits | ⬜ À faire | Packs à la carte, historique facturation |

## PHASE 8 — WIDGETS

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 26 | Backend widgets | ⬜ À faire | CRUD, config JSON, embed code |
| 27 | Widget carrousel | ⬜ À faire | Composant JS embeddable |
| 28 | Widget badge | ⬜ À faire | Badge note moyenne |

## PHASE 9 — FINITIONS

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 29 | Paramètres entreprise | ⬜ À faire | Infos générales, notifications, slug |
| 30 | Gestion équipe | ⬜ À faire | Invitation membres, rôles |
| 31 | Profil & sécurité | ⬜ À faire | Changement mot de passe, avatar |
| 32 | Super Admin | ⬜ À faire | Panel global, compte periebastien@gmail.com |
| 33 | Polish UI | ⬜ À faire | Responsive mobile, états vides, loaders |

## PHASE 10 — DÉPLOIEMENT

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 34 | Tests & corrections | ⬜ À faire | |
| 35 | Config OVH | ⬜ À faire | PM2 + Nginx reverse proxy |
| 36 | Déploiement | ⬜ À faire | Build prod, SSL Let's Encrypt, ns3181892.ip-146-59-148.eu |

---

## Références techniques critiques

### Google Maps API (IMPORTANT)
- Lib : `@googlemaps/js-api-loader` **v2.x**
- **La classe `Loader` est supprimée** — utiliser uniquement :
  ```js
  import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
  setOptions({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY, version: 'weekly', language: 'fr' })
  const places = await importLibrary('places')
  // Autocomplete : new places.AutocompleteService()
  // Détails : new Place({ id }).fetchFields({ fields: [...] })
  ```
- APIs à activer dans Google Cloud Console : Maps JavaScript API + Places API
- `VITE_GOOGLE_API_KEY` dans `frontend/.env`

### Variables d'environnement backend
```
PORT=3000
DB_NAME=locagain
DB_USER, DB_PASS, DB_HOST
JWT_SECRET
ENCRYPTION_KEY   # AES-256-GCM, 32 bytes hex
```

### Variables d'environnement frontend
```
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_API_KEY=...
VITE_GOOGLE_CLIENT_ID=...
```

### Migrations exécutées (toutes en base)
1. create-users
2. create-plans
3. create-businesses (inclut `google_place_id`)
4. create-locations
5. create-google-connections
6. create-reviews
7. create-customers
8. create-remaining (invitations, widgets, credits, subscriptions, team_members, business_modules)
9. add-google-auth-to-users
10. add-place-name-to-businesses (`google_place_name`)
11. add-place-name-to-locations (`locations.google_place_name`)
12. drop-gmb-from-businesses (retire `google_place_id`/`google_place_name` de `businesses`)
13. make-location-place-id-required (`locations.google_place_id` NOT NULL)
14. add-website-to-locations (`locations.website_url` — sert au favicon/logo)
15. add-slug-to-locations (`locations.slug` + backfill + index unique `business_id,slug` — URL publique de collecte)
16. create-private-feedbacks (retours note ≤ 3 de la page de collecte)

### Bugs corrigés — ne pas reproduire

| Bug | Cause | Fix appliqué |
|-----|-------|-------------|
| Page blanche onboarding | `new Loader()` au module load | `React.lazy()` + `<Suspense>` sur `OnboardingPage` |
| "Loader class no longer available" | v2.x a supprimé la classe | `setOptions()` + `importLibrary()` |
| Dropdown clippé dans Settings | `overflow-hidden` sur le parent | Supprimé du container Section |
| GMB non sauvegardé à la création | `create()` ignorait `google_place_id` | Ajouté dans `business.service.js create()` |
| PlaceSearch limitée à la France | `country='FR'` par défaut | `country=''` par défaut (global) |
| « Unexpected end of JSON input » au DELETE | `api.js` faisait `res.json()` sur un `204 No Content` | `if (res.status === 204) return null` avant `res.json()` |
| Dropdown PlaceSearch rouvert après sélection (masque les boutons) | `setQuery(place.name)` re-déclenchait la recherche | Flag `justSelectedRef` qui saute le cycle suivant |

### Lien Google review
```
https://search.google.com/local/writereview?placeid=PLACE_ID
```
Logique de la page collecte : note > 4 → ce lien ; note ≤ 3 → formulaire privé interne.
