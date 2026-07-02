# PROGRESS — Locagain MVP
> Dernière mise à jour : 2026-07-01 (responsive admin + cadrage module geogrid §9.5)
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
| 19b | Campagnes & scalabilité | ✅ Terminé | Page Invitations : campagnes avec cadence (X/jour ou X/semaine), cron job envoi planifié, pause/reprise/annulation. Page Clients : icônes canal par invitation reçue (✉×N, 📱×N). Endpoints stats + search (50 résultats, déchiffrement partiel) pour scalabilité 5000+ clients. |

## PHASE 6 — AVIS GOOGLE

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 20 | OAuth Google Business Profile | ✅ Terminé | Flow OAuth2 complet (state JWT signé, tokens AES-256-GCM), modèle GoogleConnection, section Settings connect/disconnect. ⚠️ Ajouter `http://localhost:3000/api/v1/google/callback` dans Google Cloud Console → Identifiants → URI de redirection autorisés. |
| 21 | Sync avis | ✅ Terminé (DataForSEO, 2026-07-02) | **Bascule GMB → DataForSEO** (quota GMB abandonné). Provider `business_data/google/reviews` (task_post→tasks_ready→task_get), table `review_sync_jobs`, cron boucle 60s (backfill/incrémental), **gating par plan** (`module_quotas.reviews`), échelonnement déterministe, upsert via index unique. Migrations 43-45. Vérifié en réel (64 avis Atlas importés) + preview. Voir détail ci-dessous. |
| 22 | Interface avis | 🟡 Lecture faite | `ReviewsPage` lit les avis DataForSEO (bouton Synchroniser asynchrone + polling, file Priority). **Répondre aux avis** repoussé (2ᵉ temps) : génération par IA prévue (prompt configurable). ⚠️ DataForSEO ne **publie pas** sur Google → canal d'écriture à trancher (API GMB ou saisie manuelle assistée). |

### Bascule synchro avis GMB → DataForSEO (session 21, 2026-07-02)

**Pourquoi** : l'autorisation GMB (quota `mybusinessaccountmanagement.googleapis.com` = 0, projet Cloud non vérifié) est trop complexe à obtenir. On réutilise **DataForSEO** (déjà en place pour le geogrid) pour **lire** les avis. Plus besoin d'OAuth : la synchro marche pour toute localisation ayant un `google_place_id`.

**Backend** (module `reviews/` refondu, mécanique GMB retirée) :
- **Provider** `providers/dataforseo-reviews.provider.js` : endpoint `business_data/google/reviews` (task_post→tasks_ready→task_get), **distinct du geogrid** (serp/google/maps) → `tasks_ready` séparé, aucune collision de poll. ⚠️ **`location_coordinate` obligatoire même avec `place_id`** (la doc dit l'inverse à tort — sinon `40501 Invalid Field: location_name`) : on envoie les coordonnées de la fiche.
- **Table** `review_sync_jobs` (1 job = 1 tâche pour 1 fiche) + colonnes `locations.{last,next}_reviews_sync_at`/`reviews_backfilled_at`. **Index unique** `reviews (platform, external_id)` (migration 45) pour l'upsert `ON CONFLICT` (jamais posé avant car sync GMB jamais exécuté).
- **Mapping** : `review_id→external_id`, `profile_name→author_name`, `rating.value→rating`, `review_text→text`, `timestamp→published_at`, `owner_answer→reply_text`, `owner_timestamp→reply_time`.
- **Service** : `enqueueDueLocations` (fiches dues, **échelonnement déterministe** par hash d'UUID → jamais d'appels en rafale), `pollRunningJobs` (upsert + garde-fou saturation), `failStuckJobs`, `triggerSync` (manuel, gaté), `getSyncStatus` (polling front). Backfill au 1er passage (depth 200), incrémental ensuite (depth 10, `sort_by=newest`).
- **Gating par plan** (`module_quotas.reviews`, migration 44) : **Starter** quotidien (1440 min) · **Pro** toutes les 6h (360) · **Agence** toutes les heures (60) · **Gratuit exclu**. `interval_minutes` pilote la cadence. Éditable Super Admin.
- **Cron** `jobs/sync-reviews.js` : boucle `setInterval` (modèle geogrid), `failStuck→poll→enqueueDue`, poll silencieux à vide. File **standard** en auto (économique), **priority** pour le bouton manuel (~1 min).

**Coût DataForSEO** (facturé sur le depth **demandé**, par tranche de 10) : incrémental depth 10 = **$0.00075/synchro** (standard) ; backfill 200 = **$0.015 one-shot/fiche**. Par fiche, ~$0.02–0.54/mois selon le plan. `.env` : `REVIEWS_*` (tick, depth, backfill, queue…).

**Frontend** : `ReviewsPage` — `POST /sync` (async) → polling `/sync/status` → recharge. Gère le 403 (plan sans synchro).

**Vérifié en réel** : 2 fiches Atlasimmobilier (Starter), **64 avis importés** (39+25), mapping complet (notes/dates/auteurs OK, `owner_answer` lu — la fiche n'a juste aucune réponse), place_id `ChIJ…` validé. Preview : rendu des 64 avis, bouton Synchroniser (POST 200 + polling 200), 0 erreur console. Données de test `seed-` nettoyées.

**Limite à trancher (2ᵉ temps)** : DataForSEO est en **lecture seule**. La génération IA d'une réponse est faisable, mais sa **publication** sur Google nécessitera l'API GMB (écriture) ou une saisie manuelle assistée. Le module `google/` OAuth est laissé **inerte** (non supprimé) pour cette éventualité.

## PHASE 7 — CRÉDITS & STRIPE

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 23 | Backend crédits | ✅ Terminé | Module credits/ (balance, history, add), middleware checkCredits, 50 crédits de bienvenue à la création d'entreprise, page /credits (solde + jauge + historique paginé) |
| 24 | Stripe abonnements | ✅ Terminé | Module stripe/ (checkout abonnement + webhook), 4 plans en base (Gratuit/Starter 29€/Pro 50€/Agence 90€), page /pricing, stripe_price_id à renseigner depuis Super Admin quand Stripe configuré |
| 25 | Achat crédits | ✅ Terminé | Checkout packs crédits (50/200/500), webhook payment → crédits, section packs sur page /credits. Sidebar : lien crédits + icône ⚡ + bouton Upgrade → /pricing |

## PHASE 8 — WIDGETS

> 📐 Design system widgets (catalogue, modèle de config complet, gabarits HTML, anti-fuite) : **`WIDGETS_DESIGN_FR.md`** — à mettre à jour à chaque nouveau widget/option.

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 26 | Backend widgets | ✅ Terminé | Migration 21 (location_id), modèle Widget, module widgets/ (CRUD + route publique /public), embed code généré automatiquement, monté dans app.js |
| 26b | Tags d'avis + filtrage widgets | ✅ Terminé | Migrations 22-24 (tags, review_tags N–N, widgets.tag_id), module tags/ CRUD, tagging des avis (PUT /reviews/:id/tags), getPublic widget filtre business+location+tag et renvoie avis + agrégat note. Voir détail ci-dessous |
| 27 | Widget carrousel + builder | ✅ Terminé | Backend config-aware (widget.defaults.js + mergeDefaults, getPublic minRating symétrique/tri/limite/id avis/googleUrl/powered-by gratuit, validation update, cache), runtime vanilla (slider/grille/liste + badge, Shadow DOM, classes lcg-), endpoints runtime.js/embed.js/preview, builder frontend (WidgetsPage + WidgetBuilderPage, form piloté par schéma, aperçu live iframe). Vérifié visuellement (5 styles + thème sombre + fallbacks). Voir détail ci-dessous |
| 28 | Widget badge + embed | 🟡 Largement couvert en 27 | Rendu badge compact/encadré + bootstrap embed.js + copier l'embed déjà livrés. Reste : polish badge (tailles/formes), grep anti-fuite avant commit, « lire plus » carrousel. Polish 2026-07-01 : option **`containerPadding`** (« Marge intérieure », 0–64px) sur badge + carrousel, note explicative police « Du site », aperçu builder (cache-bust runtime + police fallback) — voir `WIDGETS_DESIGN_FR.md` §3.1. Bug corrigé (2026-07-01) : défaut `align` passé de `left` à `center`. Le bloc « Propulsé par Locagain » du badge reste **toujours centré sous le badge lui-même** quel que soit `align` (le badge se positionne gauche/centre/droite dans son conteneur ; la légende suit le centre du badge, jamais flush sur son bord) — double structure `.lcg-wrap` (positionnement) / `.lcg-wrap-inner` (centrage badge+légende), testé en Shadow DOM isolé (centres identiques à &lt;1px près) |

### Détail session 27 — Carrousel + builder (2026-07-01)

**Backend** (aucune migration — colonnes `type`/`config`/`location_id`/`tag_id` déjà en place) :
- `widget.defaults.js` : `mergeDefaults(type, config)` complète + assainit (bornage nombres, validation enums/couleurs, **rejet des clés arbitraires** dans le JSONB). Testé unitairement.
- `getPublic` refondu via `buildPayload` partagé : `minRating` appliqué **symétriquement** (count + AVG + liste), `sort` (recent/highest/lowest/random), `limit` borné `min(cfg,50)`, expose l'`id` de l'avis (jamais `external_id`/`reply_text`/email), `googleUrl` dérivé de `Location.google_place_id` (null si pas de location), `showPoweredBy` forcé `true` en plan gratuit (sans exposer le plan). Testé bout en bout contre PostgreSQL (avis temporaires + nettoyage).
- `update` : merge profond sur la config existante puis `mergeDefaults` (validation). `create` : `mergeDefaults`.
- `widget.runtime.js` : moteur **vanilla** (Function.toString) — rend carrousel (slider/grille/liste) + badge (compact/encadré). Thème clair/sombre/auto, couleurs par élément, police, étoiles SVG inline, dates relatives `Intl.RelativeTimeFormat`, note `Intl.NumberFormat` (virgule FR), fallbacks auteur/texte null. Classes `lcg-`, **zéro asset tiers**. Slider : autoplay, flèches, points, pause survol, `prefers-reduced-motion`, responsive.
- `widget.controller`/`routes` : `GET /runtime.js` (statique), `GET /:id/embed.js` (bootstrap Shadow DOM), `POST /preview` (auth, config non persistée — isolation via filtre `business_id`), `Cache-Control` sur public/runtime/embed.
- Réponse `/public` : `{ id, type, style, config, location_id, tag_id, googleUrl, aggregate:{count,average}, reviews:[{id,author_name,rating,text,published_at}] }`.

**Frontend** :
- `lib/widget-schema.js` : miroir des défauts backend + descripteurs de champs (sections Apparence/Contenu/Comportement) — source de vérité du builder.
- `WidgetsPage` (`/widgets`) : liste + créer/supprimer. `WidgetBuilderPage` (`/widgets/new`, `/widgets/:id`) : formulaire piloté par le schéma (toggles, color pickers Auto/Transparent, selects, nombres) + **aperçu live** dans une iframe qui charge le **vrai runtime** (source de rendu unique → zéro dérive) via `POST /preview` + `postMessage`. Copier l'embed. Routes dans `App.jsx`.

**Vérifs** : `mergeDefaults` (bornage/rejet) OK, e2e `getPublic` OK (agrégat, minRating symétrique, googleUrl, powered-by), `vite build` OK (1832 modules), **rendu visuel confirmé** (5 styles + thème sombre + accent custom + fallbacks null, 0 erreur console).

**Bug corrigé (2026-07-01)** : le modèle `Review` activait les timestamps Sequelize mais la table `reviews` n'a pas `updated_at` → cassait **toute lecture** d'avis (`/reviews`, dashboard, widgets) et non pas seulement le futur `Review.upsert` du sync. Fix : `updatedAt: false` sur le modèle `Review`.

**Polish builder (2026-07-01)** : les catégories de paramètres (Source des avis, Apparence, Contenu, Comportement) sont des **accordéons** (première ouverte, autres fermées, indépendants) → hauteur réduite. Le chip bordure « Transp. » → **« Aucune »** (le fond garde « Transp. »). Le select de localisation affiche **nom + adresse** (localisations homonymes non confondues). Vérifié visuellement.

**Données de test** : synchro GMB bloquée (quota) → avis factices via `node scripts/test-reviews.js add|clear` (external_id préfixé `seed-`, le `clear` ne touche jamais aux vrais avis). 3 avis de test sur la localisation Marrakech pour l'entreprise Atlasimmobilier.

### Détail session 26b — Tags d'avis + filtrage des widgets (2026-06-30)

**Concept** : couche de classification éditoriale par-dessus les avis. L'entreprise définit ses propres tags ; on tague les avis ; on choisit un tag (et/ou une localisation) pour peupler un widget.

**Décisions actées** : relation **N–N** (un avis = plusieurs tags) ; tags **100 % manuels** au MVP (auto-tagging par note repoussé) ; `tag_id` en **colonne** sur `widgets` (cohérent avec `location_id`, FK `SET NULL`) ; champ **`color`** sur les tags pour les pastilles UI.

**Backend** :
- Migrations `22` (table `tags` : `business_id`, `name`, `color` + index unique `business_id,name`), `23` (table de liaison `review_tags` : PK composite `review_id`+`tag_id`, FK `CASCADE`), `24` (`widgets.tag_id` FK `SET NULL`).
- Modèles `Tag.js`, `ReviewTag.js` (junction, `timestamps: false`), `tag_id` ajouté à `Widget.js`.
- ⚠️ **Aucune association Sequelize** dans ce projet (convention) → la liaison N–N est gérée **manuellement** (requêtes `where` + `Op.in`), pas de `belongsToMany`/`include`.
- Module `tags/` : CRUD `POST/GET/PATCH/DELETE /api/v1/tags` (isolation `business_id`, conflit nom → 409).
- Reviews : `PUT /api/v1/reviews/:id/tags` (body `{ tag_ids: [...] }`, remplace l'ensemble ; vérifie que chaque tag appartient au business). `listReviews` enrichit chaque avis d'un tableau `tags`.
- Widget `getPublic` : filtre `business_id` + `location_id` (si défini) + avis portant le `tag_id` (si défini) ; renvoie `reviews` (50 max, champs publics) + `aggregate { count, average }` (moyenne calculée sur **tout** le jeu filtré, pour le badge).
- `tag.routes` montées dans `app.js` sur `/api/v1/tags`.

**Frontend** : à venir — UI de tagging sur la page Avis (session 22) + sélecteur de tag dans le builder widget (session 27).

**Vérifs** : migrations 22-24 appliquées, `node --check` OK, backend redémarré, routes testées (tags/reviews protégées → 401, widget public UUID invalide → 404 propre, pas de 500).

## PHASE 9 — FINITIONS

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 29 | Paramètres entreprise | ⬜ À faire | Infos générales, notifications, slug |
| 30 | Gestion équipe | ⬜ À faire | Invitation membres, rôles |
| 31 | Profil & sécurité | ⬜ À faire | Changement mot de passe, avatar |
| 32 | Super Admin | ⬜ À faire | Panel global, compte periebastien@gmail.com. Inclut CRUD plans (nom, description, prix, crédits/mois, features JSONB, stripe_price_id, active) — voir cahier des charges §10 |
| 33 | Polish UI | 🟡 Partiel | **Responsive full admin ✅** (voir détail ci-dessous). Reste : états vides, loaders |

### Détail — Responsive full admin (2026-07-01)

Rend l'interface d'admin pleinement utilisable sur mobile (avant : layout desktop fixe uniquement). Aligné sur le cahier des charges **§8.7** ajouté le même jour (breakpoints, sidebar drawer, mobile-first).

**Squelette de layout** :
- `AppLayout` : marge `lg:ml-60` (pleine largeur sous `lg`), overlay mobile qui ferme le drawer, padding `p-4 sm:p-6`, état `sidebarOpen`.
- `Sidebar` : drawer coulissant hors-écran sous `lg` (`fixed … -translate-x-full lg:translate-x-0`, `z-40`), bouton ✕ (mobile), fermeture auto au clic sur un lien / une localisation / Upgrade (prop `onClose` propagée).
- `TopBar` : bouton burger (`Menu`, `lg:hidden`), padding `px-4 sm:px-6`, titre `truncate`, nom d'entreprise masqué sous `sm` (avatar seul → libère la place pour les boutons d'action).

**Pages** :
- `DashboardPage` : KPI `grid-cols-2 lg:grid-cols-4`, grille basse `grid-cols-1 lg:grid-cols-3` (+ `lg:col-span-2`).
- `ReviewsPage` : filtres empilés `flex-col sm:flex-row`, selects fluides `w-full sm:w-56/44`.
- Grilles de formulaire 2-col → `grid-cols-1 sm:grid-cols-2` : `CollectSettingsPage`, `InvitationsPage`, `CustomersPage`, `SettingsPage`, `OnboardingPage`.
- Déjà responsive (rien à changer) : `WidgetBuilderPage` (`lg:grid-cols-[…]`), table `CustomersPage` (`hidden md:table-cell`), `PricingPage`.

**Vérifs** : `vite` compile sans erreur, 0 erreur console, pas de débordement horizontal (pages publiques). Vérif visuelle de l'admin connecté validée par l'utilisateur.

## PHASE 10 — DÉPLOIEMENT

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| 34 | Tests & corrections | ⬜ À faire | |
| 35 | Config OVH | ⬜ À faire | PM2 + Nginx reverse proxy |
| 36 | Déploiement | ⬜ À faire | Build prod, SSL Let's Encrypt, ns3181892.ip-146-59-148.eu |

## PHASE 11 — SUIVI DE POSITIONNEMENT (GEOGRID) *(post-MVP, planifié)*

> 📐 Spec technique du socle : **`GEOGRID_DESIGN_FR.md`** — cahier des charges §9.5.
> 🧭 **Refonte (2026-07-02)** — wizard config + suivi + concurrents + rapport email : **`GEOGRID_REFONTE_FR.md`**. Remplace le plan G5 initial (« timeline & polish ») par un découpage G5→G12 plus large. Décisions actées : source = **DataForSEO** ; facturation = **gating par plan, plafonds éditables en Super Admin (G12)** ; périmètre = **complet** (grille wizard + heatmap + multi mots-clés + concurrents + timeline + rapport email). Ancrage déjà en base (`locations.lat/lng` + `google_place_id`).

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| G1 | Backend — schéma & grille | ✅ Terminé | Migrations `geogrid_keywords`/`geogrid_scans`/`geogrid_points` + `plans.module_quotas`, modèles, `buildGrid()`, module `rank-tracking/` (CRUD mots-clés + gating quota par plan). Voir détail ci-dessous |
| G2 | Backend — provider & scan | ✅ Terminé | `providers/` (interface + `dataforseo.provider`), `scan.service.js` (création + polling + finalisation), endpoints scans, calcul ARP/ATRP/SoLV. Testé avec un vrai scan DataForSEO (25 points, données réelles). Voir détail ci-dessous |
| G3 | Backend — cron & poll | ✅ Terminé | `jobs/scan-geogrid.js` (boucle 90s : timeout + poll + lancement des dus), scalabilité (lot/concurrence/pool bornés), paramètres `.env`. Testé cron réel de bout en bout (scan lancé + terminé en autonomie). Voir détail ci-dessous |
| G4 | Frontend — heatmap | ✅ Terminé | `GeogridPage` (`/positionnement`, lazy) + `GeogridMap` (carte Google + pastilles rang colorées + InfoWindow concurrents), gestion mots-clés, gating par plan, scan + polling, métriques. Vérifié avec données réelles (structure/metrics/API OK). Voir détail ci-dessous |
| G5 | Refonte — modèle & config partagée | ✅ Terminé (2026-07-02) | Migration **additive uniquement** (expand, pas de contract) : 4 nouvelles tables + colonnes + migration de données. Voir détail ci-dessous |
| G6 | Backend — planning & grille cercle | ✅ Terminé (2026-07-02) | Cutover complet : forme cercle (masque disque), planning `next_run_at` fuseau-aware (Luxon), cron réécrit par runs/configs, retrait des champs legacy du mot-clé. Voir détail ci-dessous |
| G7 | Backend — concurrents & agrégats | ✅ Terminé (2026-07-02) | CRUD concurrents + quota par config, agrégats fiche+concurrents (top 3/10/20), `MAX_COMPETITORS` 5→20, endpoints `config`/`competitors`/`runs`/`trend`, quota mots-clés/concurrents passé **par localisation**. Voir détail ci-dessous |
| G8 | Frontend — Configuration (wizard) | ✅ Terminé (2026-07-02) | **G8.1** : squelette + Étape Grille. **G8.2** : Étapes Mots-clés + Planning. **G8.3** : Étape Concurrents + récap + premier rapport + mode édition. Voir détail ci-dessous |
| G9 | Frontend — Suivi | ⬜ À faire | Vue globale + par mot-clé, tableaux triables, courbes Recharts |
| G10 | Frontend — Concurrents | ⬜ À faire | Page de comparaison + courbes |
| G11 | Rapport email (v1) | ⬜ À faire | Config email chiffrée (AES-256-GCM), résumé + lien |
| G12 | Super Admin — quotas `rank_tracking` | ⬜ À faire | Édition des plafonds par plan sans redéploiement |

> **Dépendances front à ajouter** au dev : lib carte (Google Maps déjà chargé via `@googlemaps/js-api-loader` — sinon Leaflet) + lib chart (aucune présente).
> **`.env` backend** : `RANK_PROVIDER`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` déjà renseignés (2026-07-01), identifiants validés contre l'API DataForSEO (solde ~0,69 $).

### Détail session G1 — Backend schéma & grille (2026-07-01)

**Migrations 25-28** : `geogrid_keywords` (business_id, location_id, keyword, grid_size, grid_spacing_m, frequency, active — unique `location_id+keyword`), `geogrid_scans` (colonnes métriques ARP/ATRP/SoLV + statut pending/running/done/failed, prêt pour G2), `geogrid_points` (row/col/quadrant/lat/lng/rank/competitors JSONB, prêt pour G2 — **pas de colonne `updated_at`**, `updatedAt: false` sur le modèle, leçon du bug `Review`), et `plans.module_quotas` (nouvelle colonne JSONB — voir décision ci-dessous).

**Décision de conception — `plans.module_quotas` plutôt que `plans.features`** : `plans.features` est un tableau de strings (affichage marketing sur `/pricing`, consommé tel quel par `PricingPage.jsx`) — pas exploitable pour des quotas machine-readable. Ajout d'une colonne dédiée `module_quotas` (JSONB, clé `module_key` comme `business_modules`) : `{ rank_tracking: { enabled, max_keywords, grid_size, grid_spacing_m, frequency } }`. Additive, ne touche pas à l'existant. Seedé par la migration : **Gratuit** = `{}` (absent → désactivé), **Starter** = 5 mots-clés/7×7/hebdo, **Pro** = 15/9×9/hebdo, **Agence** = 50/13×13/hebdo (Pro/Agence indicatifs, à ajuster).

**Module `modules/rank-tracking/`** :
- `geogrid.utils.js` — `buildGrid(centerLat, centerLng, gridSize, spacingM)` : grille N×N (mètres→degrés, longitude corrigée par `cos(latitude)`), quadrants NW/NE/SW/SE/C, rejette les tailles paires. Vérifié en isolation (7×7 → 49 points, centre exact, répartition quadrants cohérente).
- `rank-tracking.service.js` — isolation `assertAccess` (pattern tags/reviews), `getQuota(business)` lit `plan.module_quotas.rank_tracking`, `assertQuotaAvailable` compte les mots-clés actifs. `grid_size`/`frequency` **cappés silencieusement** au plafond du plan (clamp, pas de 400) ; `daily` rejeté (403) si le plan n'inclut que `weekly`.
- Endpoints (`/api/v1/rank-tracking`, montés dans `app.js`) : `GET /quota`, `GET /grid-preview`, `POST/GET /keywords`, `PATCH/DELETE /keywords/:id`.
- **Scope volontairement limité** : pas de vérification `business_modules` (override hors-plan) — table existante mais sans modèle Sequelize ni middleware dans le projet ; gating **plan uniquement** pour G1. Créer `BusinessModule.js` + middleware `checkModule` reste à faire séparément si un besoin de bêta-test hors-plan se présente.

**Tests réels contre PostgreSQL** (backend redémarré, business de test `Atlasimmobilier` — plan basculé temporairement Starter puis restauré `null`) :
- Sans plan : `GET /quota` → `{enabled:false}`, `POST /keywords` → 403.
- Plan Starter : 5 créations → 201, 6ᵉ → 403 (limite), doublon même localisation → 409, `PATCH grid_size:13` → clampé à 7, `PATCH frequency:daily` → 403, `DELETE` → 204, `grid-preview` 7×7/500m → 49 points centrés sur la fiche.
- Isolation : sans token → 401, `business_id` inexistant → 404.
- Données de test nettoyées, `plan_id` de l'entreprise restauré à `null` après coup.

**Vérifs** : `node --check` sur les 13 fichiers créés/modifiés OK, migrations appliquées, backend redémarré (`PostgreSQL connecté` + crons OK).

### Détail session G2 — Provider DataForSEO & scan (2026-07-01)

**Recherche préalable contre l'API réelle** (pas de code écrit à l'aveugle sur une doc tierce) : appel `live/advanced` révèle que **Live n'accepte qu'une seule tâche par appel** (`"You can set only one task at a time"`) — invalide l'idée d'un scan grille synchrone en un seul appel. Confirmé le flux correct : `task_post` (jusqu'à 100 tâches/appel, queue **Standard**, ~0,0006 $/tâche) → `tasks_ready` (corrélation par `tag`) → `task_get/advanced/{id}` (résultats : `place_id`, `rank_absolute`, `rating.value`, `rating.votes_count`). Un scan de grille (à la demande ou cron) utilise donc **toujours** la queue asynchrone — la distinction Live/Standard du design doc portera sur un futur « check rapide 1 point », pas sur le geogrid complet.

**Migrations 29-30** : `geogrid_points.provider_task_id` + `fetched_at` (`fetched_at IS NULL` = pas encore résolu, distinct de `rank IS NULL` = résolu mais absent du Top 20) ; **fix `geogrid_scans.credits_used`** INTEGER → DECIMAL(10,4) — bug attrapé en test réel (25 tâches × 0,0006 $ = 0,015, rejeté par Postgres en colonne INTEGER). Les 25 tâches déjà soumises à DataForSEO (payées) ont été récupérées après coup plutôt que perdues/resoumises.

**`providers/`** : interface commune `submitTasks/getReadyTaskIds/getTaskResult`, implémentation `dataforseo.provider.js` (auth Basic, chunking à 100 tâches, timeout 20s), sélecteur `index.js` piloté par `RANK_PROVIDER`.

**`scan.service.js`** : `createScan` (génère la grille via `buildGrid`, ids de points pré-générés côté JS pour servir de `tag` de corrélation, insère les points, soumet les tâches, un point sans tâche acceptée reste `provider_task_id: null` — limite connue, pas de retry automatique en G2) ; `refreshScan` (idempotent — pense à `tasks_ready` puis `task_get` uniquement sur les tâches prêtes, met à jour `rank`/`competitors`/`fetched_at` par point, capture `rating_snapshot`/`review_count_snapshot` à la première fiche trouvée, finalise le scan — `arp`/`atrp`/`solv` — une fois tous les points résolus) ; safety-net quota revérifié à la création du scan (indépendant de la vérification faite à la création du mot-clé, au cas où le plan aurait changé depuis).

**Endpoints** : `POST /scans` (créer), `GET /scans` (historique), `GET /scans/:id` (détail + points), `POST /scans/:id/refresh` (poll manuel — réutilisé tel quel par le cron G3).

**Test réel contre DataForSEO** (business `Atlasimmobilier`, plan Starter temporaire, grille 5×5 = 25 points, coût réel 0,015 $) : scan complété en ~1 poll, **13/25 points classés**, ARP=14.00, ATRP=17.36 (vérifié à la main : `(13×14+12×21)/25=17.36` ✓), SoLV=0 %, `rating_snapshot`=4.6/25 avis (exact, vérifié contre un appel Live indépendant). Heatmap cohérente géographiquement : rang 5 au centre/sud, non classée au nord — le pattern exact que le module est censé révéler. Concurrents par point peuplés et corrects (cible exclue). Contrôle d'accès (401/403/404) et gating replacé vérifiés après restauration du plan à `null`. Données de test entièrement nettoyées (scan+points cascade, mot-clé, `plan_id` restauré).

**Vérifs** : `node --check` sur les 8 fichiers créés/modifiés OK, 2 migrations appliquées, backend redémarré (`PostgreSQL connecté` + crons OK).

**Décision post-G2 (2026-07-01) — queue DataForSEO Priority retenue** : passage de la queue Standard (~0,0006 $/tâche, ~5 min) à **Priority** (~0,0012 $/tâche, ~1 min) — `TASK_PRIORITY = 2` dans `dataforseo.provider.js` (champ `priority` du payload `task_post`). Vérifié en réel : coût exact (0,0012 $), délai réel observé 1-2 s sur un scan 3×3 (bien en dessous de la moyenne annoncée), forme de réponse identique à Standard. Décision motivée par le **design du cron G3** : turnaround plus rapide et prévisible → poll plus rapproché possible → la file `tasks_ready` de DataForSEO (plafonnée à **1000 résultats non récupérés**, vérifié en réel) reste sous pression plus faible à l'échelle. Surcoût jugé anecdotique (~0,76 $/mois/entreprise pour 7×7×3 mots-clés hebdo vs ~0,40 $ en Standard). Docs mis à jour (`GEOGRID_DESIGN_FR.md` §3/§9, cahier §9.5).

### Détail session G3 — Cron & poll (2026-07-01)

**Architecture retenue (validée avec l'utilisateur)** : **une seule boucle** `setInterval` (et non node-cron — 90 s n'est pas exprimable en cron, champ secondes ≤ 59) dans `jobs/scan-geogrid.js`, avec **garde anti-chevauchement**. Chaque tick, dans l'ordre : `failStuckScans` → `refreshRunningScans` → `runDueScans`.

**Scalabilité (bcp de fiches — la préoccupation soulevée)** :
- **Détection « dû »** via nouvelle colonne `geogrid_keywords.last_scanned_at` (migration 31, index `(active, last_scanned_at)`), posée **avant** la soumission → un échec (grille invalide, fournisseur KO) ne relance pas le mot-clé à chaque tick (retry à la fenêtre suivante ; scan manuel = échappatoire). Requête des dus : `last_scanned_at` NULL (jamais scanné, `NULLS FIRST`) ou plus vieux que la fenêtre (`weekly` 7 j / `daily` 1 j).
- **Lot borné** `GEOGRID_BATCH_SIZE` (20) mots-clés/tick + **parallélisme plafonné** `GEOGRID_CONCURRENCY` (20) → étale la charge, pas de salve.
- **Pool PostgreSQL relevé 5 → 20** (`DB_POOL_MAX` dans `database.js`) pour absorber les 20 lancements parallèles sans saturer le pool (chaque scan ~5 requêtes).
- **Un seul `tasks_ready` par tick** partagé entre tous les scans `running` (au lieu d'un appel par scan) → réduit la pression sur la file DataForSEO (plafonnée à 1000, vérifié en réel).
- **Garde-fou scan bloqué** : `pending/running` plus vieux que `GEOGRID_SCAN_TIMEOUT_MINUTES` (15) → `failed` (points déjà obtenus conservés). 15 min ≈ 10 cycles de poll — réaliste vs turnaround ~1 min, plus les 24h initialement envisagées.
- **Downgrade** : un mot-clé dont l'entreprise n'a plus `rank_tracking` au plan est ignoré (pas scanné).

**Queue DataForSEO** : Priority (décision précédente) → turnaround ~1 min → poll toutes les 90 s finit un scan en ~2 ticks.

**Paramètres réglables dans `.env`** (défauts en secours dans `rank-tracking.config.js`) : `GEOGRID_TICK_SECONDS=90`, `GEOGRID_BATCH_SIZE=20`, `GEOGRID_CONCURRENCY=20`, `GEOGRID_SCAN_TIMEOUT_MINUTES=15`, `DB_POOL_MAX=20`. Ajoutés à `.env` et `.env.example`.

**Refactor `scan.service.js`** : extraction de `submitScanForKeyword(keyword)` et `applyRefresh(scan, readyTags?)` (cœurs sans contrôle d'accès, partagés entre endpoints HTTP et cron). Piège corrigé : `created_at` est un timestamp auto-géré → nom d'attribut `createdAt` en camelCase même avec `underscored: true` (contrairement aux colonnes custom snake_case), sinon la clause `where` du balayage ne filtre pas.

**Tests réels** : (1) fonctions cron en isolation (grille 3×3) — `runDueScans` lance 1 puis 0 (détection « dû » + `last_scanned_at`), `refreshRunningScans` finalise (ARP/ATRP corrects), `failStuckScans` bascule un scan artificiellement vieux en `failed`. (2) **Cron réel de bout en bout** : mot-clé créé → la boucle du backend le détecte, lance le scan (~tick 1) et le finalise (tick 2), **done en 122 s, 8/9 points classés** — sans aucune action manuelle. Données de test nettoyées, plan restauré à `null`.

**Vérifs** : `node --check` sur les 7 fichiers OK, migration 31 appliquée, backend redémarré (`[cron] Job geogrid démarré (tick 90s...)`). Note : lignes de tick du cron bufferisées en dev (nohup) — PM2 flushe stdout en prod.

**Prochaine session : G4 — heatmap frontend** (`GeogridPage`, carte Google + pastilles de rang, sélecteur mot-clé, métriques, concurrents par point).

### Détail session G4 — Heatmap frontend (2026-07-01)

**Fichiers créés** :
- `frontend/src/lib/geogrid.js` — `rankColor(rank)` / `rankLabel(rank)` / `RANK_LEGEND` (buckets Top 3 vert / 4-10 orange / 11-20 rouge / non classé rouge foncé — hex nécessaires pour les marqueurs canvas, alignés sur les tokens du thème).
- `frontend/src/components/GeogridMap.jsx` — carte Google Maps : `importLibrary('maps'|'marker')` (même loader que `PlaceSearch`), **marqueur `Marker` legacy** (pas d'`AdvancedMarkerElement` qui exigerait un `mapId` Cloud) = pastille circulaire colorée + rang au centre, `fitBounds` auto sur la grille, clic → `InfoWindow` listant les concurrents du point. Fallback chargement/erreur.
- `frontend/src/pages/GeogridPage.jsx` — orchestration : gating par plan (écran verrouillé + CTA `/pricing` si `quota.enabled=false`), gestion des mots-clés (ajout borné au quota, suppression, sélecteur), bouton « Scanner maintenant », **polling** (`POST /scans/:id/refresh` toutes les 4 s jusqu'à `done/failed`, avec token d'annulation au changement de mot-clé / démontage — pattern de polling introduit, inexistant avant dans le front), reprise auto du polling si le dernier scan est `running`, 4 `MetricCard` (ARP/ATRP/SoLV/note), légende + date, états vides.

**Branchements** : `App.jsx` (route `/positionnement` en `lazy`+`Suspense`, comme Onboarding/Collect — page lourde car charge Maps), `Sidebar.jsx` (icône `Target` + entrée « Positionnement » dans la section MODULES, **sans `soon`** donc cliquable).

**Conventions respectées** : hooks `useBusiness`/`useLocations` (fallback `|| {}`), `business_id` en query param sur chaque appel, wrapping `AppLayout`, classes Tailwind sémantiques, gestion `loading`/`error`/vide en miroir des pages existantes (QRCode/WidgetBuilder).

**Vérification (preview navigateur, données réelles)** : page rendue à `/positionnement` avec un vrai scan (Atlasimmobilier/Marrakech, 5×5) → sélecteur mot-clé, quota « 1/5 », **métriques correctes** (ARP 12.69, ATRP 16.68, SoLV 0 %, note 4.6/25 avis), légende, pied « Grille 5×5 · 13/25 points classés · date ». Sidebar « Positionnement » cliquable. Tous les appels API 200 (quota/keywords/scans/detail). `vite build` OK (1835 modules, `GeogridPage` en chunk lazy 12,5 kB).

**Limite de vérif** : la **heatmap Google Maps elle-même ne se peint pas dans le navigateur de preview headless** — confirmé que ce n'est pas mon code : l'API Maps **brute** (`new google.maps.Map` dans un div neuf hors composant) produit le même résultat (conteneur créé, pas de `.gm-style`, pas de tuiles). Limitation connue des navigateurs automatisés ; la carte s'affiche dans un vrai navigateur. Mon composant exécute le bon chemin (lib chargée, `Map` instanciée, `Marker` créés — warning de dépréciation observé).

**Démo laissée en place pour vérif visuelle utilisateur** : entreprise de test **Atlasimmobilier** passée en plan **Starter** + 1 mot-clé « agence immobiliere marrakech » avec un scan terminé → visible sur `/positionnement` via le compte de test (à reverter : `plan_id` → `null` + purge geogrid_* quand terminé).

**Prochaine session initialement prévue : G5 — timeline & polish.** Remplacée le 2026-07-02 par la refonte cadrée dans `GEOGRID_REFONTE_FR.md` (wizard config + suivi + concurrents + rapport email + planification fine + quotas éditables Super Admin) — nouveau découpage G5→G12 ci-dessus. La timeline devient **G9**.

### Détail session G5 — Refonte : modèle & config partagée (2026-07-02)

**Approche retenue : migration additive (« expand »), pas de cutover.** Plutôt que de migrer `grid_size`/`grid_spacing_m`/`frequency`/`last_scanned_at` hors de `geogrid_keywords` en une passe (ce qui aurait cassé `findDueKeywords`/`submitScanForKeyword` tant que le cron n'est pas réécrit), G5 se limite à **ajouter** les nouvelles tables/colonnes et à **peupler** les configs depuis les données existantes — zéro changement de comportement. Le cutover (retrait des anciennes colonnes, bascule du cron sur `next_run_at`/runs, réécriture `normalizeGridSize`/`normalizeFrequency`) est explicitement reporté à **G6**, livré comme une unité cohérente avec G5 (cf. `GEOGRID_REFONTE_FR.md` §16 « G5 et G6 indissociables »).

**8 migrations (20260702000032→039)** :
- `geogrid_configs` (1/localisation, UNIQUE `location_id`) — grille (centre/forme/taille/espacement), planning (fréquence/heure/jour/fuseau/`next_run_at`), rapport email (destinataires/cadence).
- `geogrid_competitors` (concurrents par config, UNIQUE `config_id`+`place_id`).
- `geogrid_runs` (1 exécution = N scans, avec `has_failures` pour les runs partiellement échoués — cf. §16).
- `geogrid_scan_competitors` (agrégats concurrent par scan : position moyenne, top 3/10/20).
- `geogrid_keywords.config_id` (nullable, `onDelete: SET NULL`) et `geogrid_scans.run_id`/`points_top3`/`points_top10`/`points_top20` (idem, scans « legacy » restent `run_id: null`).
- **Migration de données** : pour chaque localisation ayant des mots-clés, crée 1 `geogrid_config` (valeurs du mot-clé le plus récent, fuseau = `business.timezone`), rattache tous les mots-clés de la localisation.
- **Quotas enrichis additivement** : `max_grid_size`/`allowed_shapes`/`allowed_frequencies`/`max_competitors` ajoutés à `plans.module_quotas.rank_tracking` **sans retirer** les anciennes clés (fusion jsonb `||`) — le code actuel (`normalizeGridSize`/`normalizeFrequency`) continue de lire les anciennes clés sans régression.

**Vérifié contre la vraie base PostgreSQL** : les 8 migrations appliquées sans erreur. Requête post-migration confirmée : 1 `geogrid_config` créée pour Atlasimmobilier (grille 7×7/500m/hebdo reprise du mot-clé existant, **`timezone: "Africa/Casablanca"`** dérivé de `business.timezone` — pas le défaut Europe/Paris, cohérent avec la démo Marrakech), mot-clé « agence immobilière » rattaché via `config_id`. Quotas Starter/Pro/Agence enrichis avec les nouvelles clés en conservant les anciennes ; Gratuit inchangé (toujours sans clé `rank_tracking`).

**Non-régression vérifiée en preview réel** (backend redémarré, compte de test, business Atlasimmobilier) : `/positionnement` inchangée — mot-clé, quota 1/5, 4 `MetricCard` (ARP 14.63, ATRP 19.96, SoLV 2 %, note 4.6/25 avis), grille 7×7 · 8/49 points classés. Tous les appels API `rank-tracking` (`/quota`, `/keywords`, `/scans`, `/scans/:id`) → 200 OK. Aucune erreur console/réseau. (Écran de la carte non capturable en navigateur headless — limitation documentée depuis G4, pas un bug.)

**Prochaine session initialement : G6 — backend planning & grille cercle.** Faite dans la foulée (2026-07-02) — voir détail ci-dessous.

### Détail session G6 — Backend planning & grille cercle (2026-07-02)

**Cutover complet** (la moitié « contract » de l'expand-contract commencé en G5) : grille et planning quittent définitivement le mot-clé, le cron bascule sur `next_run_at`/runs. Livré en un seul commit cohérent, comme prévu (§16).

**Grille cercle** (`geogrid.utils.js`) : `buildGrid()` accepte un 5ᵉ paramètre `shape` (`'square'` défaut, `'circle'`). Cercle = masque disque sur la même grille carrée (prédicat `row²+col² ≤ half²`, `half=(N-1)/2`) — aucune refonte du modèle géométrique (row/col/quadrant inchangés). Prédicat vérifié par le calcul avant écriture (7×7→29, 9×9→49, 5×5→13 points, correspond exactement au tableau du cahier) puis **revérifié en direct via `/grid-preview?shape=circle`** : 49 (carré) vs 29 (cercle) sur la même grille 7×7.

**Planning fuseau-aware** (nouveau fichier `schedule.utils.js`, dépendance **Luxon** ajoutée) : `computeNextRunAt(config, timezone, fromDate)` calcule la prochaine occurrence (quotidien/hebdo/mensuel, heure + jour + fuseau, clamp fin de mois pour le 29/30/31). Toujours appelée avec l'**ancre** du planning (le `next_run_at` courant), jamais `now`, pour ne jamais dériver si un tick est en retard. **Testé en isolation avant intégration** : 7 cas (quotidien avant/après l'heure, hebdo avec rollover semaine suivante, jour cible = aujourd'hui mais heure passée, mensuel avec clamp 31→30 en avril, mensuel avec rollover mois suivant), fuseaux Europe/Paris et Africa/Casablanca — tous corrects, vérifiés à la main.

**Auto-provisioning des configs** (`rank-tracking.service.js`) : `ensureConfigForLocation(location, business)` — récupère la config existante d'une localisation ou en crée une avec des défauts sûrs (plafonnés par les nouvelles clés de quota `max_grid_size`/`allowed_frequencies`, repli sur les anciennes clés). Appelée à la création d'un mot-clé (remplace l'ancienne gestion `grid_size`/`grid_spacing_m`/`frequency` au niveau mot-clé, qui disparaît de `create()`/`update()`) et défensivement dans `scan.service.js` (`loadConfigForKeyword`) pour tout mot-clé sans `config_id` (auto-guérison). **Testé en direct** : création d'un 2ᵉ mot-clé sur la même localisation → réutilise la config existante (pas de doublon, vérifié en base).

**Cron réécrit par runs** (`scan.service.js`, `jobs/scan-geogrid.js`) : `findDueConfigs` (remplace `findDueKeywords`, filtre sur `geogrid_configs.next_run_at`, NULL traité comme dû — filet de sécurité), `launchRunForConfig` (avance `next_run_at` **avant** tout scan — même principe anti-boucle que `last_scanned_at` en G3 — crée un `geogrid_run`, scanne tous les mots-clés actifs de la config via `Promise.allSettled`, un échec de lancement individuel ne bloque pas les autres), `runDueConfigs` (paquets par `concurrency`, ignore les configs downgradées), `closeFinishedRuns` (clôture les runs dont tous les scans sont terminaux ; `has_failures` se déclenche aussi si moins de scans que de mots-clés visés existent — auto-guérison en cas de crash pendant le lancement). Ordre du tick : `failStuckScans` → `refreshRunningScans` → `closeFinishedRuns` → `runDueConfigs`.

**`submitScanForKeyword`** : source désormais la grille (taille/espacement/forme/centre) depuis la **config** du mot-clé (plus ses propres champs, supprimés) ; accepte un `runId` optionnel (présent pour un run planifié, absent pour un scan manuel ad-hoc — **`POST /scans` reste inchangé et fonctionnel**, le bouton « Scanner maintenant » actuel n'a pas besoin d'être touché avant G8).

**Migration finale (contract)** — 2 migrations :
- 40 : retrait de `grid_size`/`grid_spacing_m`/`frequency`/`last_scanned_at` de `geogrid_keywords` (+ nettoyage du type ENUM Postgres orphelin). Sûr : G5 avait déjà recopié ces valeurs dans `geogrid_configs`, et le frontend actuel ne lit/écrit jamais ces champs au niveau mot-clé (vérifié dans l'exploration G5).
- 41 : calcule et pose `next_run_at` sur les configs existantes créées par G5 (qui n'en avaient pas) — **evite qu'au premier tick après déploiement, le cron ne lance un scan réel surprise** (facturé chez DataForSEO) sur la démo. Résultat vérifié : config Atlasimmobilier → `next_run_at` = lundi 6 juillet 03:00 UTC (04:00 Casablanca), calcul manuel confirmé exact.

**Tests réels effectués** (contre la vraie base + un vrai appel DataForSEO, données nettoyées après coup) :
1. Ajout d'un mot-clé de test → `POST /keywords` 201, config réutilisée (pas de doublon), puis `DELETE` → 204. Testé en preview navigateur.
2. **Cycle complet run réel** : config temporairement réduite à une grille 3×3 (coût minimal, ~0,011 $), `runDueConfigs` forcé → run créé (`status:running`, `keywords_total:1`), scan créé avec `run_id` et `points_total:9` (confirme la grille sourcée depuis la config), `refreshRunningScans` fait progresser les points (0→4/9 en 80s — le scan n'a pas eu le temps de finir dans la fenêtre du test, sans rapport avec le code). Config restaurée à l'identique (grille 7×7, `next_run_at` original) après coup.
3. **`closeFinishedRuns` en isolation** (4 scénarios synthétiques, rapides et gratuits) : tous scans done → run done ; un scan failed → run done + `has_failures:true` ; un scan encore running → run **non clôturé** (vérifie qu'on n'anticipe pas) ; moins de scans que de mots-clés visés → `has_failures:true` (détection d'échec de lancement). Les 4 passent exactement comme attendu.
4. Bonus involontaire : un run orphelin issu d'un bug de script de test (0 scan associé, `status:running`) a été correctement détecté et clôturé par `closeFinishedRuns` avec `has_failures:true` lors d'une exécution ultérieure — confirmation en conditions réelles du comportement auto-réparateur documenté en §16.

**Vérifs** : `node --check` sur les 8 fichiers touchés/créés OK, smoke-test de chargement des modules OK, 2 migrations appliquées, backend redémarré proprement (un seul listener, aucune erreur), page `/positionnement` identique à l'état pré-G6 en preview (mot-clé, quota, métriques, grille). Données de test entièrement nettoyées, config restaurée à l'identique.

**Prochaine session initialement : G7 — backend concurrents & agrégats.** Faite dans la foulée (2026-07-02) — voir détail ci-dessous. Entre G6 et G7, une petite parenthèse : section sidebar « POSITIONNEMENT » anticipée de G8 (nav uniquement — Configuration/Suivi/Concurrents, route `/positionnement` renommée `/positionnement/configuration`) pour donner un premier retour visuel après deux sessions 100% backend.

### Détail session G7 — Backend concurrents & agrégats (2026-07-02)

**Nouveau fichier `competitor.service.js`** : CRUD concurrents (`list`/`create`/`remove`) scopé par `config_id` (donc par localisation), quota `max_competitors` du plan (Starter 3 / Pro 5 / Agence 10, testé en direct : 3ᵉ accepté, 4ᵉ rejeté 403). Agrégation par scan (`aggregateCompetitorOnPoints`) : même convention que l'ATRP de la fiche — position moyenne sur **tous** les points du scan, `NOT_RANKED=21` imputé partout où le `place_id` du concurrent est absent du JSONB `geogrid_points.competitors` (« hors profondeur mesurée », pas position réelle — bornée à `MAX_COMPETITORS`). `computeAndStoreForScan` (delete-then-insert, idempotent, pas d'upsert Sequelize sur contrainte composite) appelée automatiquement par `finalizeScan` pour les concurrents actifs de la config, et par `recompute()` (nouvel endpoint `POST /competitors/recompute`) pour rattraper rétroactivement l'historique après l'ajout d'un concurrent — **testé en direct** : 3 concurrents fictifs ajoutés puis recalculés sur le scan existant → `avg_position: 21.00`, `appearances: 0` partout (cohérent : place_id inventés, absents des résultats réels).

**`MAX_COMPETITORS` 5 → 20** (`scan.service.js`) : la profondeur DataForSEO récupérée était déjà `depth:20`, donc pur changement de stockage, **coût data nul**.

**`finalizeScan` enrichi** : calcule et fige désormais `points_top3`/`points_top10`/`points_top20` de la fiche (comme `arp`/`atrp`/`solv`), puis déclenche l'agrégation des concurrents actifs de la config du mot-clé. **Backfill opportuniste** ajouté dans `recompute()` : les scans antérieurs à G7 (colonnes ajoutées en G5, jamais calculées avant ce commit) avaient `points_top3/10/20 = null` de façon permanente — `recompute()` les comble au passage puisqu'il charge déjà les points. **Testé en direct** sur le scan historique (G1-G4) : `points_ranked:8` → `points_top3:1`, `points_top10:1`, `points_top20:8` (cohérent : top20 = tous les points classés, par définition de la profondeur de recherche).

**Quota par localisation** (décision actée §2, différée depuis G5/G6) : `assertQuotaAvailable`/`getQuotaStatus` (mots-clés) et le quota concurrents (naturellement scopé par `config_id`) comptent désormais **par localisation**, pas par entreprise. Ajustement minimal côté front (`GeogridPage.jsx`, 1 ligne) : `GET /quota` passe maintenant `location_id`.

**Endpoints ajoutés** (`rank-tracking.routes.js`) :
- `GET/PUT /config` — lecture (auto-provisioning) et **édition stricte** de la config (forme/taille/espacement/fréquence/heure/jour/centre/fuseau) : rejette (400/403) plutôt que de plafonner silencieusement, à la différence de l'ancien `create()` de mot-clé — cohérent avec le fait que c'est un endpoit d'édition explicite. Fuseau validé via Luxon (`isValidTimezone`, nouvelle fonction `schedule.utils.js`). Recalcule `next_run_at` à chaque sauvegarde.
- `GET/POST /competitors`, `DELETE /competitors/:id`, `POST /competitors/recompute`.
- `POST /runs` (rapport manuel — scanne **tous** les mots-clés actifs de la localisation, contrairement à l'ancien `POST /scans` mono-mot-clé **toujours exposé et inchangé** pour l'UI actuelle), `GET /runs`, `GET /runs/:id`.
- `GET /trend` — série brute des scans terminés d'un mot-clé (pas d'agrégation jour/semaine/mois ici, ce sera la couche de visualisation en G9).

**Refactor `scan.service.js`** : `launchRunForConfig` (cron) séparé en `launchRun(config, trigger, scheduledFor)` (cœur partagé, sans effet de bord sur la planification) + `launchRunForConfig` (avance `next_run_at` puis délègue) + `createRun` (endpoint manuel, ne touche jamais `next_run_at`).

**Tests réels effectués** (contre la vraie base, backend redémarré, données nettoyées après coup) :
1. `GET/PUT /config` : mise à jour valide (forme cercle + heure 6h) → `next_run_at` recalculé correctement (05:00 UTC = 6h Casablanca) ; grille 13 (plafond Starter 7) → 403 ; fréquence `daily` (non incluse Starter) → 403 ; fuseau invalide → 400. Config restaurée à l'identique après coup (`next_run_at` exactement égal à sa valeur d'avant test).
2. Concurrents : création ×3 → 201, doublon → 409, quota atteint (4ᵉ) → 403, liste correcte.
3. `POST /competitors/recompute` : backfill réel vérifié en base (agrégats concurrents + `points_top3/10/20` fiche).
4. `POST /runs` (grille temporairement réduite à 3×3 pour coût minimal) : run créé `trigger:'manual'`, `scheduled_for:null`, scan lié par `run_id`, **`next_run_at` de la config non modifié** (confirmé en base, valeur identique avant/après — la planification n'est pas perturbée par un rapport manuel).
5. `GET /runs` (liste vide, cohérent), `GET /trend` (historique correct avec les nouveaux champs).

**Vérifs** : `node --check` sur tous les fichiers touchés/créés OK, smoke-test de chargement des modules OK, migration appliquée (index unique `geogrid_scan_competitors(scan_id, place_id)`), backend redémarré proprement à deux reprises (dont une pour charger le correctif du backfill), page `/positionnement/configuration` identique à l'état pré-G7 en preview. Toutes les données de test (concurrents fictifs, run manuel, scan/points associés) supprimées, config restaurée à l'identique (`grid_size`, `shape`, `run_hour`, `next_run_at` tous vérifiés égaux à leur valeur d'avant session).

**G8 découpé en 3 sous-sessions** (validé avec l'utilisateur) : G8.1 (squelette + Étape 1 Grille), G8.2 (Étapes Mots-clés + Planning), G8.3 (Étape Concurrents + récap + premier rapport + édition).

### Détail session G8.1 — Frontend : squelette wizard + Étape 1 Grille (2026-07-02)

Première session **produisant de l'UI visible** de la refonte (G5→G7 étaient 100 % backend). Recon préalable (agent Explore) des patterns réutilisables : stepper d'`OnboardingPage`, `PlaceSearch`, sélecteur de fuseau (`TIMEZONES` + `Select`), chargement Maps de `GeogridMap`.

**Nouveaux fichiers** :
- `components/common/StepIndicator.jsx` — stepper réutilisable (généralisé depuis le pattern d'OnboardingPage), étapes déjà atteintes cliquables.
- `components/GeogridConfigMap.jsx` — 2ᵉ carte Google Maps, distincte de `GeogridMap` (heatmap lecture seule) : **marqueur central déplaçable** (`draggable`, callback `dragend` → `onCenterChange`) + points d'aperçu (petits points accent, non cliquables, pas de rang). Recadrage (`fitBounds`) piloté par un `fitToken` qui ne change qu'aux changements de taille/espacement/recentrage — **pas** au glissement (sinon la carte sauterait sous les doigts).
- `pages/GeogridConfigPage.jsx` — le wizard : `StepIndicator` 4 étapes (Grille/Mots-clés/Planning/Concurrents), gardes (pas de localisation / chargement / plan verrouillé) reprises de `GeogridPage`. **Étape 1 (Grille) complète** : forme carré/cercle (gating `allowed_shapes`), densité (tailles impaires ≤ `max_grid_size`), espacement (presets 250→2000 m), bouton « recentrer sur la fiche », **compteur live** (points · couverture ~km · coût estimé ~$/rapport) branché sur `/grid-preview` (débounce 300 ms). Sauvegarde via `PUT /config` puis passage à l'étape 2. Étapes 2-4 = placeholders indiquant la sous-session à venir.

**Routage** (`App.jsx` + `Sidebar.jsx`) : le wizard prend l'entrée **« Configuration »** (`/positionnement/configuration`) ; l'ancienne `GeogridPage` (mots-clés + heatmap + résultats) est **déplacée sur l'entrée « Suivi »** (`/positionnement/suivi`, dégrisée) — préserve l'accès à tout ce qui marche déjà pendant la construction du wizard, jusqu'à ce que G9 refasse la vraie page Suivi. `/positionnement` redirige vers `/configuration`. `GeogridConfigPage` en `React.lazy`.

**Vérifié en preview réel** (compte de test, Atlasimmobilier) : page chargée sans erreur console, `GET /quota` + `GET /config` + `GET /grid-preview` → 200. **Compteur exact** : 7×7 carré → 49 points / ~3 km / ~0,06 $ ; bascule cercle → **29 points** / ~0,03 $ (masque disque, recalcul débounced correct) ; retour carré → 49. **`PUT /config` → 200**, passage à l'étape 2, config vérifiée en base (carré 7×7 500, `center` null = suit la fiche car marqueur non déplacé, `next_run_at` intact). Navigation étape 2 → placeholder → retour étape 1 OK. (Carte non capturable en screenshot headless — limitation Maps documentée depuis G4 ; rendu OK en vrai navigateur.) Aucune donnée de démo modifiée.

**Révision G8.1 (2026-07-02, retours utilisateur + screenshots)** : (1) **carte pleine largeur** en haut, configuration (forme/densité/espacement) **sous** la carte, stats (points · couverture) **à côté du bouton** « Enregistrer et continuer ». (2) **Points d'aperçu plus gros et foncés** (scale 8, `#1F1F2B` + liseré blanc, au lieu de scale 5 violet à 55 %) pour bien ressortir sur Google Maps. (3) **Cercle = disque des N² points les plus proches du centre** : même nombre de points que le carré (49 pour 7×7) MAIS les points **remplissent le cercle** (distribution 9-7-7-5-1 par rang pour 7×7, rangs -4..4, coins absents) au lieu de former un carré. Deux itérations : v0 « masque disque » (29 pts, rejeté : moins de points), v1 « contour autour du carré » (49 pts mais forme carrée, rejeté sur screenshot), **v2 retenue** = N² plus proches (49 pts + forme cercle). Contour `google.maps.Circle` + couverture (diamètre) dérivés côté front du point le plus éloigné. Doc §2/§6/§16 mise à jour. (4) **Coût en $ retiré** de l'UI (interne ; « points par rapport au pack » à définir plus tard). Vérifié : `buildGrid` en isolation (49/49, disque symétrique, coins absents) + API live (`grid-preview` cercle → 49 pts, 9-7-7-5-1) + preview (carré 49/~3 km, cercle 49/~4 km, coût absent, aucune erreur). Marqueur central déplaçable conservé (validé par l'utilisateur). Config de démo intacte.

**Prochaine session initialement : G8.2.** Faite dans la foulée (2026-07-02) — voir détail ci-dessous.

### Détail session G8.2 — Frontend : Étapes Mots-clés + Planning (2026-07-02)

Session **100 % frontend** (aucun endpoint backend nécessaire — tout existait déjà depuis G7 : CRUD mots-clés, `PUT /config` pour les champs de planning). `GeogridConfigPage.jsx` étendu, pas de nouveau fichier.

**Étape 2 (Mots-clés)** : reprise du pattern d'ajout/suppression de l'ancienne `GeogridPage` (liste + formulaire + compteur quota), adapté au wizard — chargés au montage (ajout d'un 3ᵉ appel dans le `Promise.all` initial, aux côtés de `quota`/`config`). Pas de bouton « Continuer » actif tant qu'aucun mot-clé n'est ajouté (un rapport sans mot-clé n'a pas de sens). Ajout/suppression immédiats (pas de bouton « Enregistrer » — comme avant, ce sont des actions API directes).

**Étape 3 (Planning)** : fréquence (bridée par `quota.allowed_frequencies`), heure de lancement (0-23h), puis champ conditionnel — jour de la semaine si hebdo (`DAYS_OF_WEEK` indexé 0=dimanche..6=samedi, **même convention que `schedule.utils.js`** côté backend, donc l'index du tableau est directement la valeur à stocker) ou jour du mois si mensuel (1-31, note sur le clamp fin de mois). Fuseau horaire : réutilisation verbatim de la liste `TIMEZONES` déjà présente dans `OnboardingPage`/`SettingsPage` (inclut `Africa/Casablanca`, pas de nouveau composant). Sauvegarde via `PUT /config`, qui renvoie la config à jour — affichage du **`next_run_at` recalculé** (« Prochain rapport planifié le... ») comme confirmation.

**Contrainte de session** : l'utilisateur a repris la main sur le serveur frontend (terminal manuel, suite à une coupure du serveur de preview) — mon outil de preview ne peut plus piloter le port 5173 sans le couper, ce qui aurait annulé son terminal. **Vérification faite différemment** : pas de clic-par-clic dans un navigateur piloté, mais (1) vérif syntaxique du fichier via `esbuild` (bundle à blanc, dépendances externalisées) — aucune erreur, et (2) **vérification bout-en-bout des endpoints via un script Node authentifié** (login réel + appels API) contre le backend tournant : `PUT /config` en fréquence mensuelle (jour 15, 10h, fuseau Paris) → `next_run_at` = 15 juillet 08:00 UTC (10h Paris en été, calcul juste), restauration exacte aux valeurs d'origine (`weekly`/4h/`run_day_of_week` null/Casablanca, `next_run_at` identique à l'avant-test), ajout + suppression d'un mot-clé de test → liste revenue à l'unique mot-clé réel. Toutes les données de démo confirmées intactes après coup (config et mots-clés relus en base).

**Vérif visuelle en attente** : contrairement aux sessions précédentes, le rendu réel dans le navigateur n'a pas été confirmé par capture/clic automatisés cette fois (limitation ci-dessus) — à valider par l'utilisateur directement (HMR Vite déjà actif, pas de redémarrage nécessaire).

**Prochaine session initialement : G8.3.** Faite dans la foulée (2026-07-02) — voir détail ci-dessous. **G8 est maintenant complet.**

### Détail session G8.3 — Frontend : Étape Concurrents + récap + premier rapport + édition (2026-07-02)

**Petit ajout backend** (annoncé en amont) : `competitor.service.js` gagne `detected(businessId, userId, configId)` — parcourt les 20 scans les plus récents de la config, dédoublonne les concurrents vus dans `geogrid_points.competitors` qui ne sont PAS déjà suivis, retourne triés par meilleur rang observé (plafonné à 30). Nouvel endpoint `GET /competitors/detected`. **Testé en direct contre les vraies données de démo** : 30 concurrents détectés (agences immobilières de Marrakech réelles), triés correctement.

**Étape 4 (Concurrents, optionnelle)** : ajout par recherche (`PlaceSearch`, réutilisé tel quel — `key={competitors.length}` pour forcer sa réinitialisation après chaque ajout, sans modifier le composant partagé lui-même puisqu'il est aussi utilisé par Onboarding/Localisations avec un usage différent où garder le nom affiché après sélection est voulu) + liste de puces cliquables pour les concurrents détectés (chargement paresseux, seulement à la visite de l'étape). Bouton « Passer cette étape » si aucun concurrent (décision actée : les concurrents peuvent être ajoutés après un premier rapport).

**Étape 5 (Récap & lancement)** — pas un 5ᵉ point dans le stepper (qui reste à 4 dimensions de config), mais un écran de conclusion : résumé des 4 dimensions avec lien « Modifier » vers l'étape correspondante, affichage du `next_run_at`, bouton **« Lancer un premier rapport maintenant »** → `POST /runs` (déjà construit et testé en G7, pas de nouvelle logique côté cron/scan) → état de succès avec lien vers Suivi.

**Mode édition** : une localisation déjà configurée (≥1 mot-clé au chargement) atterrit directement à l'étape 5 au lieu de l'étape 1 — accès libre à toutes les étapes via le `StepIndicator` existant (dont la logique `step.id <= current` déverrouille déjà tout une fois `current=5`, sans code supplémentaire). Solution volontairement minimale : pas de notion séparée de « mode édition », juste un choix d'étape de démarrage.

**Décision pour la suite (pas cette session)** : l'ancienne `GeogridPage` (résultats/heatmap) reste à `/positionnement/suivi` — son retrait est repoussé à **G9**, qui la remplace par la vraie page Suivi ; la retirer maintenant aurait supprimé tout moyen de voir les résultats avant G9.

**Vérifié** : `esbuild` (bundle à blanc, aucune erreur de syntaxe) + série de tests API authentifiés contre le backend réel — `GET /competitors/detected` (30 résultats réels), cycle complet `POST`/`GET`/`DELETE /competitors` (avec les mêmes champs que le frontend consomme). *Pas* de nouveau test réel de `POST /runs` avec coût DataForSEO : ce chemin est inchangé depuis G7 où il a déjà été prouvé (voir détail G7), seul le branchement frontend est nouveau. Vérification visuelle toujours en attente côté utilisateur (contrainte de session : port 5173 tenu par un terminal externe) — mais entre G8.2 et G8.3, l'utilisateur a lui-même ajouté 4 mots-clés réels via l'Étape 2, confirmant que ce morceau fonctionne bien en conditions réelles.

**Correctif retour utilisateur (2026-07-02, même jour)** : le tri des concurrents détectés par « meilleur rang vu » était peu discriminant — avec 5 mots-clés × ~49 points, presque toute fiche sérieuse décroche un #1 quelque part une fois. Remplacé par un agrégat sur l'ensemble des points/mots-clés échantillonnés : `avg_position` (façon ATRP, absence imputée à 21, sert au **tri**) + `avg_rank_when_seen` (moyenne uniquement sur les apparitions, sert à l'**affichage** — les valeurs mélangées se tassent près de 21 sur un grand pool de points, peu lisibles isolément). Chaque puce affiche désormais « Nom · N× · ØX.X » (vu N fois, position moyenne quand présent). **Vérifié en direct** sur les vraies données : le concurrent classé en tête (FJ Morocco Agency, vu 10×, Ø3.4 quand présent) n'a **jamais** été #1 (`top1_count: 0`) — preuve que l'ancien critère l'aurait complètement ignoré alors qu'il est le plus visible en réalité.

**Prochaine session : G9 — Frontend Suivi** (vue globale + par mot-clé, tableaux triables fiche+concurrents, courbes Recharts, retrait de l'ancienne `GeogridPage`).

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
17. add-email-to-google-connections (`google_account_email` VARCHAR — appliqué via ALTER TABLE direct)
18. create-invitation-campaigns (table `invitation_campaigns` + colonnes `campaign_id`, `scheduled_at`, `location_id` dans `invitations` — appliqué via ALTER TABLE direct)
19. add-reply-time-to-reviews (`reviews.reply_time`)
20. update-plans-add-stripe-fields (`stripe_price_id`, `stripe_price_id_yearly`, `stripe_product_id` sur `plans`)
21. add-location-to-widgets (`widgets.location_id` FK `SET NULL`)
22. create-tags (table `tags` : `business_id`, `name`, `color` + index unique `business_id,name`)
23. create-review-tags (liaison N–N `review_tags`, PK composite `review_id`+`tag_id`, FK `CASCADE`)
24. add-tag-to-widgets (`widgets.tag_id` FK `SET NULL`)
25. create-geogrid-keywords (table `geogrid_keywords` : business_id/location_id, keyword, grid_size, grid_spacing_m, frequency, active — unique `location_id+keyword`)
26. create-geogrid-scans (table `geogrid_scans` : métriques ARP/ATRP/SoLV, statut pending/running/done/failed)
27. create-geogrid-points (table `geogrid_points` : row/col/quadrant/lat/lng/rank/competitors JSONB)
28. add-module-quotas-to-plans (`plans.module_quotas` JSONB — quotas geogrid seedés Starter/Pro/Agence)
29. add-provider-fields-to-geogrid-points (`provider_task_id`, `fetched_at`)
30. fix-credits-used-type (`geogrid_scans.credits_used` INTEGER → DECIMAL(10,4) — coût fournisseur fractionnaire)
31. add-last-scanned-to-geogrid-keywords (`geogrid_keywords.last_scanned_at` + index `(active, last_scanned_at)` — détection « dû » du cron)

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
