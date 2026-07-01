# PROGRESS — Locagain MVP
> Dernière mise à jour : 2026-07-01 (responsive admin)
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
| 21 | Sync avis | 🚧 Bloqué | Backend complet (modèle Review, module reviews/, cron quotidien 3h, route /api/v1/reviews). Frontend ReviewsPage avec filtres + pagination. **Bloqué : quota GMB à 0** sur `mybusinessaccountmanagement.googleapis.com` — projet Cloud non vérifié. À débloquer : augmenter le quota ou publier l'app OAuth dans Cloud Console. Migration 19 (`reply_time`) à appliquer quand débloqué. |
| 22 | Interface avis | 🚧 Bloqué | Dépend de 21. Réponse aux avis (POST GMB API) à implémenter quand quota débloqué. |

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
| 28 | Widget badge + embed | 🟡 Largement couvert en 27 | Rendu badge compact/encadré + bootstrap embed.js + copier l'embed déjà livrés. Reste : polish badge (tailles/formes), grep anti-fuite avant commit, « lire plus » carrousel. Polish 2026-07-01 : option **`containerPadding`** (« Marge intérieure », 0–64px) sur badge + carrousel, note explicative police « Du site », aperçu builder (cache-bust runtime + police fallback) — voir `WIDGETS_DESIGN_FR.md` §3.1 |

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
