# PROGRESS — Locagain MVP
> Dernière mise à jour : 2026-07-05 — plusieurs sessions parallèles (orchestration multi-agents) : module « Suivi des avis de la concurrence » complet (AC1→AC3 + refontes UX) ; Phase 8 widgets complète (session 28) ; Paramètres entreprise (29) ; Super Admin `/admin/*` + quotas geogrid (32, absorbe G12) + plafonds entreprises/localisations par plan ; résilience geogrid (G10.5) + portail débit DataForSEO partagé geogrid/avis (G10.7) + polish Suivi/Concurrents (G13) ; correctif transverse isolation par localisation + audit sécurité (credits/reviews/code mort) ; bugs accès Super Admin corrigés (rôle jamais réellement posé en base, redirection login en boucle vers l'onboarding, onboarding sans déconnexion possible). Détail complet par phase ci-dessous.
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
- **Mapping** : `review_id→external_id`, `profile_name→author_name`, `profile_image_url→author_image_url` (avatars, migration 46), `rating.value→rating`, `review_text→text`, `timestamp→published_at`, `owner_answer→reply_text`, `owner_timestamp→reply_time`.
- **Service** : `enqueueDueLocations` (fiches dues, **échelonnement déterministe** par hash d'UUID → jamais d'appels en rafale), `pollRunningJobs` (upsert + garde-fou saturation), `failStuckJobs`, `triggerSync` (manuel, gaté), `getSyncStatus` (polling front). Backfill au 1er passage (depth 200), incrémental ensuite (depth 10, `sort_by=newest`).
- **Gating par plan** (`module_quotas.reviews`, migration 44) : **Starter** quotidien (1440 min) · **Pro** toutes les 6h (360) · **Agence** toutes les heures (60) · **Gratuit exclu**. `interval_minutes` pilote la cadence. Éditable Super Admin.
- **Cron** `jobs/sync-reviews.js` : boucle `setInterval` (modèle geogrid), `failStuck→poll→enqueueDue`, poll silencieux à vide. File **standard** en auto (économique), **priority** pour le bouton manuel (~1 min).

**Coût DataForSEO** (facturé sur le depth **demandé**, par tranche de 10) : incrémental depth 10 = **$0.00075/synchro** (standard) ; backfill 200 = **$0.015 one-shot/fiche**. Par fiche, ~$0.02–0.54/mois selon le plan. `.env` : `REVIEWS_*` (tick, depth, backfill, queue…).

**Frontend** : `ReviewsPage` — `POST /sync` (async) → polling `/sync/status` → recharge. Gère le 403 (plan sans synchro). Chaque avis affiche l'**avatar** de l'auteur (`EntityAvatar`, fallback initiale) et son **texte intégral** (plus de « Voir plus »).

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
| 28 | Widget badge + embed — finitions | ✅ Terminé (2026-07-04) | Rendu badge compact/encadré + bootstrap embed.js + copier l'embed déjà livrés. Polish badge (`containerPadding`, défaut `align=center`, légende toujours centrée) déjà en place depuis le 2026-07-01, vérifié conforme à `WIDGETS_DESIGN_FR.md` §3.1 sans reste à faire. Grep anti-fuite : whitelist déjà explicite (`attributes:['id','author_name','rating','text','published_at']`) sur `/public` — correctif appliqué : retrait de `location_id`/`tag_id` de la réponse publique (IDs internes non consommés par le runtime). « Lire plus » implémenté dans `widget.runtime.js` (vanilla, `showReadMore`) : texte tronqué + bouton bascule affiché/replié en place (pas de re-fetch), respecte lang FR/EN et le style des cartes. Complément même session : `showReadMore` + `ctaText` exposés dans le builder (`frontend/src/lib/widget-schema.js`) ; badge — `size` et `shape` appliqués aussi au style `framed` (padding + rayon), `starStyle=rounded` (étoiles arrondies à l'entier), `ctaText` rendu sous le badge (`.lcg-cta`, seulement si `googleUrl`) ; carrousel — `requireText` désormais effectif (filtre les avis sans texte au rendu) ; `/public` — whitelist explicite par mapping (plus d'instance Sequelize brute) + retrait de `updated_at` ; grep anti-fuite §6 (`trustindex|ti-|cdn.trustindex`) exécuté → vide. Reste à vérifier visuellement en preview (contrainte : pas de pilotage serveur cette session) |

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
| 29 | Paramètres entreprise | ✅ Terminé (2026-07-04) | Migration 54 (logo_url, contact_email/phone, address, notification_prefs JSONB) ; PATCH /businesses/:id étendu (validation slug kebab-case + unicité 409, prefs objet) ; SettingsPage enrichie (logo+aperçu, coordonnées, slug, toggles notifications auto-save) ; entrée Sidebar « ENTREPRISE > Paramètres ». Testé contre la vraie base (10 cas OK, restauration). Preview UI à revérifier après redémarrage backend. |
| 30 | Gestion équipe | ⬜ À faire | Invitation membres, rôles |
| 31 | Profil & sécurité | ⬜ À faire | Changement mot de passe, avatar |
| 32 | Super Admin | ✅ Terminé (2026-07-04, orchestration 3 agents) | Panel `/admin/*` (`AdminLayout` à onglets Plans/Comptes/Modules, réservé `role===superadmin`, absorbe G12). **Plans** : CRUD complet sur `plans-admin/` (name/description/price/monthly_credits/features JSONB/stripe_price_id(_yearly)/active/sort_order, `POST`+`PUT /api/v1/admin/plans[/:id]`, pas de DELETE — `active=false` suffit). **Comptes** : nouveau module `admin-accounts/` — vue cross-tenant inédite (`GET /api/v1/admin/accounts` avec recherche nom/email, changement de plan `PUT .../plan`), ajout de crédits réutilise l'endpoint `POST /credits/add` existant. **Modules hors plan** : nouveau modèle `BusinessModule` (mappe la table `business_modules` jusqu'ici jamais utilisée) + module `admin-modules/` (catalogue statique rank_tracking/reviews/widgets, upsert `enabled`/`activated_at`/`settings` par entreprise) — ⚠️ écriture seule pour l'instant, aucun module métier ne lit encore ce flag (le gating réel passe par `plans.module_quotas`), même posture que le hook `notify_failure` de G10.5. Aucune migration nécessaire (tous les champs existaient déjà). Testé en réel contre la vraie base sur les 3 volets (créations/mises à jour/rejets de validation, données de test nettoyées). Reste : vérification visuelle en preview navigateur (frontend piloté manuellement par l'utilisateur cette session). **Complément (2026-07-04, retour utilisateur)** : les plafonds « nombre d'entreprises » et « nombre de localisations » par plan manquaient — ajoutés. Migration 55 (`plans.max_businesses`/`max_locations`, NULL=illimité, additive). Enforcement réel (pas juste un champ admin) : `business.service.js create()` bloque la création si le propriétaire atteint le plafond (le plus permissif entre le plan Gratuit et ceux de ses entreprises existantes — un plan illimité rend l'ensemble illimité) ; `location.service.js create()` bloque si l'entreprise atteint son plafond de localisations (plan de l'entreprise, ou Gratuit si `plan_id` NULL). Champs exposés dans `GeneralForm` (`AdminPlansPage.jsx`). Complète une promesse du cahier des charges jamais implémentée (« toujours borné par le nombre de localisations autorisé par le plan », répété §9.5/§10). Testé en réel (4 scénarios : blocage à la limite, déblocage en l'augmentant, sur Atlasimmobilier + un user/business de test jetables) — tous les plans restaurés à `null` après test, zéro régression (tout illimité tant que le Super Admin ne configure rien). **Bugs découverts et corrigés en vérifiant l'accès Super Admin (2026-07-04-2026-07-05)** : (1) `periebastien@gmail.com` avait le rôle `owner` en base — le cahier/CLAUDE.md le documentait comme Super Admin mais rien ne l'avait jamais réellement posé (`UPDATE users SET role='superadmin'`, corrigé) ; ⚠️ piège découvert au passage : le rôle est lu depuis le **JWT** (généré à la connexion), pas relu en base à chaque requête — changer le rôle en base ne prend effet qu'après une **reconnexion** (nouveau token). (2) `LoginPage.jsx`/`GoogleButton.jsx` redirigeaient toujours vers `/dashboard` après connexion, quel que soit le rôle → un compte superadmin sans entreprise tombait en boucle sur `/onboarding` (`RequireBusiness`) ; corrigé pour rediriger vers `/admin/plans` si `role==='superadmin'`. (3) `OnboardingPage.jsx` n'avait **aucun** moyen de se déconnecter pour un utilisateur sans entreprise (le lien « Annuler » n'apparaissait que si `hasBusinesses`) — utilisateur bloqué dessus ; ajout d'un lien « Se déconnecter » toujours visible. |
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
| G9 | Frontend — Suivi | ✅ Terminé (2026-07-02) | **G9.1** : vue globale (tableau). **G9.2** : courbes (agrégation temporelle). **G9.3** : vue par mot-clé (carte + métriques + tableau concurrents triable) + bascule finale de route, ancienne `GeogridPage` retirée. Voir détail ci-dessous |
| G10 | Frontend — Concurrents | ✅ Terminé (2026-07-03) | Page `/positionnement/concurrents` : tableau + courbes de comparaison vs concurrents suivis, nouvel endpoint `GET /competitors/trend`. Voir détail ci-dessous |
| G10.5 | Backend — résilience cron (retry + étalement) | ✅ Terminé (2026-07-03) | Correctif hors-plan suite à un rapport planifié perdu sur blip réseau : retry 3 niveaux (transport/partiel/run) espacés + jitter déterministe, découplage cadence/reprise (migrations 50-52), circuit-breaker, plafond points en vol, saut multi-périodes, hook alerte G11. Voir détail ci-dessous |
| G10.6 | Frontend — refonte UX Suivi/Concurrents | ✅ Terminé (2026-07-03) | Page Suivi unifiée : sélecteur mot-clé (dont « Moyenne globale ») pilotant grand graphe + grande carte, clic-jour sur la courbe → carte, heatmap moyenne globale (endpoint `GET /runs/:id/average-map`). Même gabarit sur Concurrents. Voir détail ci-dessous |
| G10.7 | Backend — portail débit/concurrence DataForSEO | ✅ Terminé (2026-07-04) | Audit (2000/min compte, 60/min tasks_ready, file 1000, compte partagé geogrid+avis) → portail global `services/dataforseo-gate.js` (sémaphore concurrence + débit/min + sous-plafond tasks_ready), branché sur les DEUX providers, + fix fan-out tasks_ready. Voir détail ci-dessous |
| G11 | Rapport email (v1) | ⬜ À faire | Config email chiffrée (AES-256-GCM), résumé + lien ; **consommer `geogrid_runs.notify_failure`** (hook posé en G10.5) |
| G12 | Super Admin — quotas `rank_tracking` | ✅ Terminé (2026-07-04) | Middleware `super-admin.middleware.js` (`req.user.role === 'superadmin'`, déjà dans le JWT). Module `plans-admin` : `GET /api/v1/admin/plans` (liste rank_tracking/reviews par plan) + `PUT /api/v1/admin/plans/:planId/rank-tracking` (validation bornes : grille impaire 3-21, concurrents 0-50, mots-clés 0-200, espacement 50-5000m, fréquences daily/weekly/monthly, formes square/circle). Page frontend minimale `AdminPlansPage.jsx` (`/admin/plans`, gate `role==='superadmin'`, pas dans la sidebar — panel complet = session 32). Pas de cache : `Plan.findByPk` relu à chaque contrôle de quota → édition prise en compte immédiatement. Testé en réel sur la vraie base (update, 3 rejets de validation, restauration exacte confirmée par comparaison JSON) |
| G13 | Frontend — polish Suivi/Concurrents | ✅ Terminé (2026-07-04) | Réordonnancement Suivi (tableau → carte → courbe) ; concurrents cliquables sur Concurrents (courbe + carte recentrées sur le concurrent, 100% frontend) ; libellés des Select ; rapports `has_failures` retirés des deux sélecteurs de rapport. Voir détail ci-dessous |

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

**Correctif retour utilisateur #2 (2026-07-02, même jour)** : l'Étape 4 (Concurrents) proposait la détection automatique **avant même qu'un premier rapport ait tourné** — pour une fiche neuve, `GET /competitors/detected` n'a aucun point à analyser et renvoie forcément une liste vide, silencieusement. Le cas passait inaperçu sur Atlasimmobilier car d'anciennes données de scan (G1-G4) traînaient en base ; ça n'aurait pas fonctionné pour un vrai nouveau client.

Plutôt qu'ajouter une étape distincte dans le stepper (aurait demandé de gérer une attente de scan en plein milieu du wizard), l'Étape 4 devient **consciente du contexte** — nouveau champ `hasCompletedRun` (déduit de `GET /runs`, chargé avec le reste au montage) pilote 3 états :
- **Aucun rapport jamais exécuté** → message explicite + bouton « Lancer un premier rapport maintenant » directement dans l'étape (réutilise `launchFirstReport()`/`runLaunched`, déjà câblés pour le récap — pas de logique dupliquée : si lancé depuis l'Étape 4, le récap reflète automatiquement l'état "déjà lancé").
- **Rapport tout juste lancé depuis cette étape** → « Rapport en cours, revenez d'ici quelques minutes », pas de tentative de fetch (le scan n'est pas encore fini).
- **Au moins un rapport déjà terminé** (édition, ou après coup) → comportement inchangé, détection normale.
- La recherche manuelle (`PlaceSearch`) reste toujours disponible, peu importe l'historique. Le fetch `/competitors/detected` lui-même n'est plus déclenché tant que `hasCompletedRun` est faux (évite un appel pour rien).

**Vérifié en direct**, sur les 2 fiches réelles du compte de démo : Marrakech (avec historique) → détection normale inchangée (30 concurrents, aucune régression) ; **Essaouira (jamais scannée)** → panneau "aucun rapport" affiché correctement, bouton désactivé tant qu'aucun mot-clé n'existe, **aucun appel réseau à `/competitors/detected`** confirmé absent du journal réseau (contre présent pour Marrakech juste avant). Bonus découvert en vérifiant : l'utilisateur avait lui-même, en conditions réelles, déjà ajouté 3 concurrents ET lancé un vrai premier rapport (`trigger: manual`, 5/5 mots-clés réussis) — confirmation indépendante que tout le flux G8.3 fonctionne en vrai usage.

**Rough edge repéré en testant (non corrigé, hors-scope de ce correctif)** : le state `step` du wizard ne se réinitialise pas à 1 quand on change de localisation en cours de route sans recharger la page — passer de Marrakech (qui saute à l'étape 5) vers Essaouira laisse l'utilisateur "coincé" sur l'étape où il était (4 dans mon test), au lieu de repartir de l'étape 1 pour une fiche neuve. Correctif trivial (`else setStep(1)` dans le bootstrap `kws.length > 0`), à faire quand utile — signalé, pas appliqué sans validation.

**Prochaine session initialement : G9 — Frontend Suivi.** Découpée en 3 sous-sessions (G9.1/G9.2/G9.3, validé avec l'utilisateur). **G9.1 faite dans la foulée (2026-07-02)** — voir détail ci-dessous.

### Détail session G9.1 — Frontend : Vue globale (2026-07-02)

Nouveau fichier `pages/GeogridSuiviPage.jsx`, câblé sur une **route de dev temporaire** `/positionnement/suivi-v2` (non liée dans la sidebar) — l'ancienne `GeogridPage` reste seule accessible via « Suivi » tant que le remplacement (vue par mot-clé incluse, G9.3) n'est pas complet.

**Aucun backend nécessaire** pour cette sous-session : tout existait depuis G7 (`GET /runs`, `GET /runs/:id`). Contenu :
- **Sélecteur de rapport** : liste des `geogrid_runs` terminés (`status: 'done'`) pour la localisation active, triés du plus récent au plus ancien, plus récent sélectionné par défaut.
- **Tableau par mot-clé** (rapport sélectionné) : position moyenne (ATRP), top 3/10/20 — lues directement depuis `GeogridScan` (déjà figées au finalize depuis G7, `scan.keyword` dénormalisé évite un join).
- **Flèche d'évolution vs rapport précédent** : calculée côté front (pas de nouvel endpoint) en récupérant aussi le rapport juste avant le sélectionné dans la liste triée, puis en comparant l'ATRP par `keyword_id`. Convention : ATRP est un **rang** (plus bas = mieux), donc une **baisse** du chiffre = amélioration = flèche verte vers le haut (pas l'inverse naïf).
- **État vide** : aucun rapport → message + lien vers Configuration.
- Pas encore de clic-vers-détail (stub volontairement absent — la vue par mot-clé est G9.3, inutile de créer un lien qui ne mène nulle part avant).

**Bug trouvé et corrigé en testant** : le sélecteur affichait « Invalid Date ». Cause : `r.created_at` au lieu de `r.createdAt` — les timestamps auto-gérés par Sequelize restent en camelCase même sous `underscored: true` (contrairement aux champs explicites du modèle type `keyword_id`/`run_id`/`has_failures`, eux bien en snake_case). Corrigé aux 2 endroits (tri + affichage).

**Vérifié en direct** (preview réel, compte de démo) : tableau affichant les 5 vrais mots-clés du rapport manuel lancé par l'utilisateur (ATRP 15.27 à 21.00 selon le mot-clé, top 3/10/20 cohérents), date correctement formatée après le correctif, colonne Évolution à « — » pour tous (cohérent : un seul rapport terminé à ce jour, donc pas de précédent à comparer — cette branche du code est bien exercée, la branche "avec delta réel" est une arithmétique triviale non testée en live faute d'un 2ᵉ rapport, mais vérifiée par relecture). Aucune erreur console/réseau.

**Prochaine session initialement : G9.2.** Faite dans la foulée (2026-07-02) — voir détail ci-dessous.

### Détail session G9.2 — Frontend : Courbes (agrégation temporelle) (2026-07-02)

**`npm install recharts`** (3.9.1). Nouvelle brique réutilisable **`lib/geogrid-trend.js`** (fonctions pures, aucune dépendance de dates ajoutée — arithmétique `Date` native) :
- `bucketOf`/`bucketize` : regroupe des points `{date, value}` par jour/semaine (lundi-dimanche)/mois, agrège par **moyenne** ou **meilleure position** (`Math.min`, ATRP = rang donc plus bas = mieux — GEOGRID_REFONTE_FR.md §4.2). ⚠️ Clé de bucket construite entièrement en composants **locaux** (`getFullYear`/`getMonth`/`getDate`), jamais via `toISOString()` qui repasse par UTC et peut faire glisser le jour d'un cran selon le fuseau du navigateur — piège identifié et évité dès l'écriture, pas après coup.
- `filterByRange` : presets 30j/90j/6 mois/12 mois/tout (interprétation du « date de début réglable » du cahier — un sélecteur de plage plutôt qu'un input date brut, plus simple et standard).
- `mergeSeriesForChart` : fusionne N séries (1 par mot-clé) déjà bucketées en lignes uniques pour Recharts, alignées par clé de bucket (un mot-clé sans donnée sur un bucket reste `null`, Recharts saute juste ce segment).

**Testé en isolation avant intégration** (6 cas, via `node --input-type=module`) : fusion de 2 scans le même jour (moyenne vs meilleure), bucketing semaine avec 2 dates dans la même semaine + 1 dans la suivante (bornes lundi vérifiées), bucketing mois, valeurs `null` ignorées, fusion multi-séries avec buckets partiellement différents, filtre de plage. Tous corrects.

**Intégration dans `GeogridSuiviPage.jsx`** : chargement des mots-clés de la localisation (indépendant du rapport sélectionné dans le tableau — la courbe montre tout l'historique) puis `GET /trend` par mot-clé en parallèle (une fois, pas à chaque changement de rapport). Sélecteurs plage/granularité/mode au-dessus du graphe, axe Y **inversé** (`reversed`, rang 1 en haut = mieux), une ligne par mot-clé (couleurs cycliques), légende, tooltip.

**Vérifié en preview réel** : SVG du graphe présent, **5 lignes** (une par mot-clé, correspond aux 5 mots-clés réels), légende correcte, les 3 sélecteurs changent bien l'état du composant (testé : granularité → « Jour »). Capture d'écran impossible (même limitation que Maps depuis G4 — rendu SVG/canvas bloqué en navigateur headless, aucune erreur console associée, pas un bug de l'appli).

**Incident de session (résolu, sans rapport avec le code livré)** : mes rechargements répétés pendant la vérification ont épuisé le rate-limit global de l'API (100 req/15 min, `app.js`) puis fait perdre le token de connexion (l'appli se déconnecte sur un échec de `/auth/me`). Résolu en redémarrant le backend (rate-limit en mémoire, réinitialisé instantanément) puis en se reconnectant. Aucune conséquence sur le code ou les données.

**Prochaine session initialement : G9.3.** Faite dans la foulée (2026-07-02) — voir détail ci-dessous.

### Détail session G9.3 — Frontend : Vue par mot-clé + bascule finale (2026-07-02)

**Backend** — `scan.service.js` : `getScan()` étendu, renvoie désormais aussi `competitors` (`GeogridScanCompetitor` du scan, triés par `avg_position` ASC) en plus de `scan`/`points`. Champ additif, vérifié rétro-compatible (un scan ancien sans concurrents renvoie `competitors: []`).

**Frontend** — `GeogridSuiviPage.jsx` : clic sur une ligne du tableau (Vue Globale) → `selectedKeywordId`, bascule vers une Vue Par Mot-Clé dédiée (le rendu principal teste `if (selectedKeywordId)` avant de retomber sur la Vue Globale) :
- 4 `MetricCard` (ARP / ATRP / SoLV / note de la fiche),
- `GeogridMap` réutilisée (heatmap déjà construite en G4, aucune modification),
- `CompetitorTable` (nouveau) : fusionne la ligne « Ma fiche » avec les concurrents du scan, triable par colonne (défaut = position moyenne croissante),
- courbe de tendance réutilisée de G9.2 en version mono-série,
- bouton « Retour à la vue globale ».

**Fix backend en profitant** : la détection de concurrents (`competitor.service.js`, G7) ne se recalculait qu'à la finalisation d'un scan ou via `POST /competitors/recompute` manuel — un concurrent ajouté via le wizard restait donc absent des scans historiques antérieurs à son ajout. `GeogridConfigPage.jsx` (`addCompetitor`) déclenche maintenant un `recompute` automatique (fire-and-forget) juste après la création.

**Bascule finale de route** : `App.jsx` — suppression de l'import `GeogridPage` et de la route de dev `/positionnement/suivi-v2` ; `/positionnement/suivi` pointe désormais directement sur `GeogridSuiviPage`. Suppression du fichier `pages/GeogridPage.jsx` (plus aucune référence, `GeogridMap.jsx` conservé car réutilisé par la nouvelle page).

**Vérifié en preview réel** sur la vraie route `/positionnement/suivi` (pas la route de dev) : Vue Globale (tableau 5 mots-clés), clic → Vue Par Mot-Clé (ARP 11.50 / ATRP 20.61 / SoLV 0% / note 4.6, carte rendue, tableau concurrents trié correctement), bouton Retour → Vue Globale. ⚠️ Une erreur React (`error boundary` générique) est apparue une fois juste après l'édition de route + suppression du fichier, avant tout rechargement — un `window.location.reload()` l'a fait disparaître définitivement (état HMR périmé après suppression de fichier + édition de route pendant la même session Vite, pas un bug du code livré).

**Fin de G9** (3/3 sous-sessions). **Prochaine session initialement : G10.** Faite dans la foulée (2026-07-03) — voir détail ci-dessous.

### Détail session G10 — Frontend : page Concurrents (2026-07-03)

**Backend** — `competitor.service.js` : nouvelle fonction `trend(businessId, userId, keywordId)`, exposée en `GET /competitors/trend?keyword_id=X`. Renvoie, pour chaque concurrent actif de la config du mot-clé, sa série `avg_position` **alignée sur les mêmes scans (mêmes dates) que `GET /trend`** — ainsi les deux se bucketisent/fusionnent ensemble côté front sans réconciliation de dates (`null` pour un scan où le concurrent n'a pas encore de ligne `GeogridScanCompetitor`, ex. ajouté après coup sans recompute). C'était la seule pièce manquante : le reste (agrégats par scan, tableau triable) existait déjà depuis G7/G9.3.

**Extraction de composants partagés** (nécessaire : `CompetitorTable`/`TrendControls`/`TrendChart` vivaient en local dans `GeogridSuiviPage.jsx`, non réutilisables tels quels) :
- `components/GeogridCompetitorTable.jsx` — tableau triable « ma fiche + concurrents », inchangé au comportement près.
- `components/GeogridTrendChart.jsx` — `TrendControls` + `TrendChart` + palette `LINE_COLORS`.
- `GeogridSuiviPage.jsx` mis à jour pour importer ces deux fichiers au lieu de les définir localement (zéro changement de comportement — vérifié par non-régression complète, voir plus bas).

**Nouvelle page** `pages/GeogridConcurrentsPage.jsx` (`/positionnement/concurrents`) : sélecteur mot-clé + sélecteur rapport → `CompetitorTable` réutilisé ; courbe de comparaison multi-séries (ma fiche + 1 ligne par concurrent, mêmes réglages plage/granularité/agrégation que Suivi) via `TrendControls`/`TrendChart` réutilisés + `GET /trend` (ma fiche) et `GET /competitors/trend` (concurrents) fusionnés avec `bucketize`/`mergeSeriesForChart` existants (aucune modif de `lib/geogrid-trend.js`). Lien « Gérer les concurrents » → `/positionnement/configuration?step=4`.

**Petit ajout ciblé sur le wizard** : `GeogridConfigPage.jsx` lit désormais `?step=N` (`useSearchParams`) pour sauter directement à l'étape demandée sur une fiche déjà configurée, au lieu de toujours atterrir sur le récap — sert le lien « Gérer les concurrents » ci-dessus (retour direct à l'étape 4, §9 du cahier).

**États de garde** (même esprit que Suivi) : pas de rapport → renvoie à la Configuration ; rapport(s) mais **aucun concurrent suivi** → état vide dédié avec lien direct vers l'étape 4 (évite un tableau techniquement valide mais inutile avec la seule ligne « Ma fiche »).

**Sidebar** : entrée « Concurrents » passée de texte grisé (`soon: true`) à vrai lien, comme Suivi en G8/G9.

**Bug pré-existant corrigé au passage** : `.claude/launch.json` — la config `locagain-backend` n'avait pas de `cwd`, donc `preview_start` cherchait `package.json` à la racine du repo au lieu de `backend/`. Ajout de `"cwd": "backend"`.

**Vérifié en preview réel** (comptes/données réelles, backend + frontend redémarrés) : tableau et courbe de comparaison avec les vraies données (Guy Hoquet 8.96, Ma fiche 20.61 sur « agence immobilière » — cohérent avec G9.3), changement de mot-clé recharge bien tableau + courbe (vérifié sur « immobilier », Ma fiche 15.27 — cohérent avec Vue Globale de Suivi), lien « Gérer les concurrents » atterrit bien directement sur l'étape 4 du wizard. **Non-régression complète de `GeogridSuiviPage`** après extraction des composants partagés : Vue Globale et Vue Par Mot-Clé re-testées avec les mêmes données réelles, valeurs identiques à avant (20.61/15.27/20.71/18.57/21.00, ARP 11.50/ATRP 20.61 en vue détail) — aucune régression. Note : le rapport le plus récent (marqué « partiel ») affiche des tirets partout sur les deux pages (Suivi et Concurrents) — cohérent avec un rapport dont les scans ont échoué, pas un bug introduit ici.

Prochaine session : **G11 — Rapport email (v1)**.

### Détail session G10.5 — Backend : résilience du cron (retry + étalement) (2026-07-03)

**Déclencheur (diagnostic réel en base)** : le rapport hebdo d'Atlasimmobilier (vendredi 08:00 Casablanca) planifié correctement (`next_run_at` juste) mais **perdu** : le backend n'était pas allumé à 07:00 UTC ; au reboot (08:41) le run s'est lancé mais ses 5 scans ont tous échoué en `DataForSEO injoignable : fetch failed` (blip **transport**, pas une erreur métier — le run manuel de la veille avec les mêmes identifiants avait marché). Or `next_run_at` était avancé à vendredi suivant **avant** le scan → une semaine perdue pour un aléa réseau, sans reprise.

**Conception** : passe multi-agents (7 recon en parallèle + designs stress-testés). La relecture adverse a trouvé 6 trous dans la 1ʳᵉ ébauche (re-facturation par recréation de scan, clôture/alerte prématurée, `tasks_ready` non fiable pour la récup, dérive multi-périodes, downgrade non re-vérifié…) — tous intégrés dans la version livrée.

**Principe** : découpler la **cadence** (`geogrid_configs.next_run_at`, jamais touchée par une reprise) de l'**état de reprise** (colonnes séparées, tout en DB → survit au redémarrage). Détail architectural : `GEOGRID_REFONTE_FR.md §7.1`.

**Migrations 50-52** (additives) : `geogrid_scans.{attempts,next_attempt_at,retry_reason}` + index partiel ; `geogrid_runs.{attempts,next_attempt_at,notify_failure}` + index partiel ; statut `retry_pending` ajouté aux 2 enums (`ADD VALUE IF NOT EXISTS`, PG 16). ⚠️ Collision de numérotation bénigne : la session avis a aussi un `20260703000050-*` (tables différentes, les deux ont migré).

**Code** : nouveau `retry.utils.js` (`hashOffset` copié de la sync avis + `computeBackoffMs`) ; `schedule.utils.js` +`computeNextRunAtSkipping` (saut des périodes ratées) ; `dataforseo.provider.js` (distinction transport/métier via `err.transient`, retry court sur GET idempotents seulement) ; `scan.service.js` (primitive `postScanTasks` anti-double-POST, `scheduleScanRetry`, `relaunchDueRetryScans/Runs`, circuit-breaker en mémoire, `pointsInFlight`, `closeFinishedRuns` avec Level C + `notify_failure`, `failStuckScans` conscient de la récupération, ordre `next_run_at` corrigé) ; `scan-geogrid.js` (tick : 2 passes de reprise + portes anti-surcharge circuit/points-en-vol) ; `rank-tracking.config.js` + `.env.example` (9 nouveaux paramètres).

**3 niveaux de reprise** : **A** scan transport (0 tâche postée) → re-submit **en place**, backoff 10/30/90 min + jitter, max 3 ; **B** partiel/timeout (tâches payées) → re-poll **direct** `task_get`, coût 0 $, fenêtre 6 h ; **C** run inexploitable → replanification (backoff 30/120 min, max 2). Étalement : jitter déterministe (anti-rafale au retry) + plafond points en vol (protège la file 1000) + circuit-breaker (pause sur échecs transport en série).

**Vérifié** (règle projet : vraie base, jamais de mock) : unitaires isolés `retry.utils` (14/14) et `computeNextRunAtSkipping` (5/5, dont le cas « backend éteint 3 semaines » → 1 seul rattrapage) ; **test contrôlé Level A** (12/12, provider monkeypatché, injection échec transport puis succès) prouvant reprise en place **sans scan dupliqué**, **sans double facturation** (0 re-POST quand déjà posté), run non clôturé tant qu'un scan est `retry_pending`, crédits comptés une fois ; **test Level C/circuit/annulation** (10/10) : reprise annulée si suivi désactivé (0 crédit), circuit ouvert après N échecs, `closeFinishedRuns` replanifie puis clôture avec `notify_failure`. Toutes les passes du tick exécutées sur la vraie base sans erreur ni lancement. Données de test nettoyées, backend redémarré propre (aucun scan dû → aucun coût réel).

Prochaine session : **G11 — Rapport email (v1)** (dont la consommation du hook `notify_failure`).

### Détail session G10.6 — Frontend : refonte UX Suivi + Concurrents (2026-07-03)

Demande utilisateur : fusionner le Suivi en **une seule vue** — grand graphe + grande carte pleine largeur — pilotés par un **sélecteur de mot-clé commun**, avec sélection du jour **au clic sur le graphe**. 3 décisions produit validées (AskUserQuestion) : sélection **un mot-clé à la fois** (dont « Moyenne globale »), carte moyenne globale = **heatmap de rang moyen par point**, blocs métriques/tableaux **conservés** sous la carte.

**Backend** — 1 endpoint : `GET /rank-tracking/runs/:id/average-map` (`getRunAverageMap`) → heatmap moyenne d'un rapport : rang moyen par point de grille sur tous les scans terminés (absent imputé à `NOT_RANKED=21`, moyenne ≥ 21 → `rank:null`). Renvoie `{ center, points }` au format exact de `GeogridMap`. Vérifié sur le rapport réel du jour (49 points, 18 avec moyenne < 21, plage 7-20).

**Frontend :**
- `GeogridMap.jsx` : prop `heightClass` (mode plein écran `h-[600px]`).
- `lib/geogrid-trend.js` : export de `bucketKeyOf` (mappe un clic-graphe → clé de bucket → rapport).
- `GeogridTrendChart.jsx` : props `onDayClick` (clic sur un point → `payload` du bucket) et `height`.
- `GeogridSuiviPage.jsx` — **refonte complète** : fin de la scission vue globale/vue par mot-clé. Sélecteur mot-clé (`''` = Moyenne globale + chaque mot-clé) pilotant graphe **et** carte ; grand graphe (5 courbes en global, 1 en mot-clé ; `onDayClick` → `selectedRunId`) ; grande carte (heatmap du mot-clé via `getScan`, ou moyenne globale via le nouvel endpoint) ; métriques ARP/ATRP/SoLV/note + tableau concurrents en mode mot-clé ; tableau d'évolution (clic ligne → focus mot-clé). Mapping clic-jour : clé de bucket (`scanned_at`) → run le plus récent du bucket (net en granularité Jour).
- `GeogridConcurrentsPage.jsx` — même gabarit : grand graphe de comparaison (ma fiche + concurrents, `onDayClick`) + grande carte (ma heatmap) + tableau, réutilisant `scanDetail.points` déjà chargé.

**Vérifié en preview réel** (viewport headless à 0 au départ → résolu par `preview_resize` + reload, pas un bug appli) : Suivi mode global (5 courbes + légende + endpoint average-map), mode mot-clé (1 courbe + carte + métriques ARP/ATRP/SoLV + tableau concurrents), changement de rapport pilote carte + métriques (ATRP immobilier 15.27 le 2 juillet, cohérent avec l'historique) ; Concurrents (4 courbes ma fiche+3 concurrents + carte + tableau), zéro erreur console. Le **clic-jour** est câblé (`onDayClick` → `selectedRunId`, moitié aval vérifiée) ; la simulation d'événements internes Recharts est impossible en headless (même limite que le rendu Google Maps), à confirmer en vrai navigateur.

Prochaine session : **G11 — Rapport email (v1)**.

### Détail session G10.7 — Backend : portail débit/concurrence DataForSEO (2026-07-04)

Signalé par l'utilisateur : « des requêtes qui n'aboutissent pas » (trop d'appels API en même temps). Audit sur données réelles : **5 scans échoués `DataForSEO injoignable`** (timeouts) en 24h ; limites du compte = **2000 appels/min au total**, **60/min sur `tasks_ready`**, file plafonnée à **1000** ; compte **partagé** entre le cron geogrid (tick 90 s) et le cron avis (tick 60 s). Cause : aucune borne globale sur les connexions HTTP simultanées (les params `concurrency` bornent les scans/jobs, pas les appels réseau qu'ils déclenchent chacun) → rafales de `task_post`/`task_get` au lancement/poll, + `tasks_ready` appelé une fois **par scan** dans la reprise (au lieu d'un partagé).

**Solution** — nouveau `backend/src/services/dataforseo-gate.js` (singleton, sans dépendance) : `schedule(fn, kind)` borne (1) les requêtes **simultanées** (sémaphore, `DATAFORSEO_MAX_CONCURRENCY=12`) et (2) le **débit/min** (fenêtre glissante, `DATAFORSEO_MAX_PER_MINUTE=1500`) avec un **sous-plafond `tasks_ready`** (`DATAFORSEO_TASKS_READY_PER_MINUTE=50`) ; l'excédent est mis en file FIFO et libéré au fil des créneaux. Les **deux** providers (`dataforseo.provider.js` geogrid + `dataforseo-reviews.provider.js` avis) routent leur `fetch` via le portail → charge combinée bornée quel que soit le nombre de fiches. ⚠️ AbortSignal (timeout 20 s) créé **dans** le thunk `schedule` → le timeout ne compte que l'exécution, pas l'attente en file. Fix complémentaire : un seul `getReadyTaskIds` partagé par lot de reprises (`postScanTasks(scan, {readyMap})`) au lieu d'un par scan.

**Vérifié** : test unitaire isolé du portail (sémaphore plafonne bien la concurrence à 3, sous-plafond tasks_ready retarde le 5ᵉ appel) ; appels réels via les deux providers en parallèle (geogrid + avis `tasks_ready` aboutissent via le portail, stats cohérentes) ; backend redémarré propre (2 crons OK). Réglages `.env` (`DATAFORSEO_MAX_*`). Note : ~256 tâches geogrid résiduelles dans la file DataForSEO (scans qui avaient timeouté avant) — s'évacuent d'elles-mêmes, le portail empêche l'accumulation future. ⚠️ Le câblage du provider avis touche un fichier de la session parallèle (autorisé par l'utilisateur : « branche les deux ») — non committé côté geogrid (fichier avis non suivi).

Prochaine session : **G11 — Rapport email (v1)**.

### Détail session G13 — Frontend : polish Suivi/Concurrents (2026-07-04)

Demande utilisateur, en continuité de G9.3/G10.6 : réordonner les blocs de Suivi, rendre les concurrents cliquables sur Concurrents, clarifier les libellés, et retirer les rapports « partiels » du sélecteur (constat déjà noté en G10 : « le rapport le plus récent (marqué partiel) affiche des tirets partout — cohérent, pas un bug » — cette session en tire la conséquence UX).

**`GeogridSuiviPage.jsx`** — réordonnancement pur (aucune logique changée) : Tableau d'évolution par mot-clé (déjà cliquable) → Métriques + `CompetitorTable` (mode mot-clé) → Carte → Courbe, désormais en dernier.

**`GeogridConcurrentsPage.jsx`** — l'ordre tableau→courbe→carte était déjà correct (acquis, non retouché) :
- Libellés ajoutés devant les deux `<select>` : **« Mots-clés »** et **« Rapport »** (clarifiés avec l'utilisateur via `AskUserQuestion` — un des deux avait été demandé en anglais et l'autre coupé dans le message).
- Nouvel état `selectedCompetitorId` (place_id, `null` = Ma fiche/tous concurrents). Clic sur une ligne du tableau concurrents → focus la courbe (« Ma fiche vs {concurrent} », filtre `competitorsTrend`) et la carte (heatmap du concurrent) sur ce seul concurrent ; clic sur « Ma fiche » ou changement de mot-clé → retour à la vue par défaut (tous concurrents sur la courbe, ma heatmap sur la carte).
- Carte par concurrent construite **100% frontend**, sans nouvel endpoint : `pointsForCompetitor()` relit `scanDetail.points[].competitors` (déjà présent par point depuis G2 — chaque point stocke jusqu'à 20 concurrents avec leur rang à cet endroit précis) et reconstruit un tableau de points `{ ...point, rank: rangDuConcurrentIci }`, réinjecté tel quel dans `GeogridMap` (déjà générique : `rank` n'est pas hardcodé "ma fiche").

**`GeogridCompetitorTable.jsx`** (composant partagé Suivi+Concurrents) : props optionnelles `onRowClick`/`selectedId` (rétro-compatibles — absentes sur Suivi, comportement inchangé) ; `placeId` ajouté à chaque ligne pour permettre le matching.

**`GeogridMap.jsx`** : prop optionnelle `subjectLabel` pour reformuler l'en-tête de l'InfoWindow (« Votre rang ici » → « {concurrent} ici : #N ») quand la carte affiche un concurrent plutôt que « ma fiche » ; texte par défaut strictement inchangé si la prop est omise (aucune régression sur les usages existants).

**Rapports partiels retirés des deux sélecteurs** (`runs.filter(r => r.status === 'done' && !r.has_failures)`, Suivi et Concurrents) : vérifié en base sur les vraies données — un run (`823ba707…`) est bien `status:'done'`, `has_failures:true`, **0/5 mots-clés exploités** (Level C du système de reprise G10.5 : reprises épuisées, run inexploitable marqué « done » quand même). Confirme que ce n'est pas un bug d'affichage mais un cas réel de reprise épuisée — la méthodologie réduit ces cas mais ne les élimine pas entièrement ; on les masque du sélecteur plutôt que de les empêcher.

**Vérifié** : `esbuild --bundle` sur les 2 pages + 2 composants modifiés (aucune erreur, seuls des warnings `import.meta`/iife préexistants et sans rapport). Pas de vérif navigateur cette fois : ports 3000/5173 déjà occupés par les propres serveurs de l'utilisateur (terminaux manuels) — celui-ci a préféré une vérif par lecture de code plutôt que de les couper ; checklist de vérification manuelle transmise (ordre des blocs, clic-concurrent, libellés, disparition du rapport partiel des deux sélecteurs).

Prochaine session : **G11 — Rapport email (v1)**.

---

## PHASE 12 — SUIVI DES AVIS DE LA CONCURRENCE *(post-MVP, cadré 2026-07-03)*

> Spec complète : **`AVIS_CONCURRENTS_FR.md`**. Rythme mensuel d'avis, ma fiche vs concurrents. Liste **partagée** avec le geogrid (décision utilisateur — découplage par `place_id` prévu pour une séparation future), quota = `rank_tracking.max_competitors` (3/5/10). Source DataForSEO (Places ne fournit pas l'historique). Synchro quotidienne échelonnée via le cron sync-reviews existant.

| # | Session | Statut | Notes |
|---|---------|--------|-------|
| AC1 | Backend — données & synchro | ✅ Terminé (2026-07-03) | Migrations 47-49 (`competitor_reviews`, `review_competitor_tracking`, `review_sync_jobs.competitor_place_id`), modèles, réconciliation (`reconcileCompetitorTracking`) depuis `geogrid_competitors`, `enqueueDueCompetitors`/`enqueueSyncForCompetitor` (cadence fixe `REVIEWS_COMPETITOR_INTERVAL_MINUTES`=1440), `resolveJob` scindé (`resolveLocationJob`/`resolveCompetitorJob`, poll `tasks_ready` unifié). Voir détail ci-dessous |
| AC2 | Backend — stats mensuelles | ✅ Terminé (2026-07-03) | Migration 50 (`locations.total_reviews_count`/`avg_rating`, symétrique côté "ma fiche"), `GET /reviews/competitors/stats` (`getCompetitorStats` : agrégat SQL par mois, règle de complétude, série « ma fiche » + concurrents, `available_years`). Voir détail ci-dessous |
| AC3 | Frontend — page Concurrents (avis) | ✅ Terminé (2026-07-03) — **module complet** | Sidebar AVIS > Concurrents (`/reviews/concurrents`), gestion (PlaceSearch + détectés + quota 3/5/10), carte « Ce mois-ci » (`MetricCard`), courbe 12 mois (`TrendChart` étendu par props `yReversed`/`yLabel`), tableau mensuel (meilleur du mois surligné, mois incomplets en italique), sélecteur d'année. Backend : gating + `triggerCompetitorSync` (backfill priority ~1 min à l'ajout). Voir détail ci-dessous |

### Détail session AC1 — Backend données & synchro (2026-07-03)

**Modèle de données** : `competitor_reviews` (avis concurrents, table séparée de `reviews`, unique `location_id+place_id+external_id`) ; `review_competitor_tracking` (1 ligne = 1 concurrent actuellement suivi, miroir réconcilié de `geogrid_competitors`, unique `location_id+place_id`) ; `review_sync_jobs.competitor_place_id` (nullable, NULL = job "ma fiche").

**Réconciliation** (`reconcileCompetitorTracking`, appelée chaque tick avant l'enqueue) : diff entre les concurrents actifs de `geogrid_competitors` (résolus via `geogrid_configs.location_id`, aucune FK — découplage volontaire) et les lignes de tracking existantes, pour les seuls business dont le plan a `module_quotas.reviews.enabled`. Business devenu inéligible ou concurrent retiré/désactivé → ligne supprimée (synchro stoppée, `competitor_reviews` conservés) ; nouveau concurrent actif → ligne créée (`next_sync_at` NULL = backfill immédiat). Idempotente (vérifié : 2ᵉ passe = 0 créé/0 supprimé) et auto-réparatrice (vérifié : suppression manuelle d'une ligne + reconcile → recréée).

**Synchro** : `enqueueSyncForCompetitor` soumet une tâche DataForSEO avec le `place_id` **du concurrent** et `location_coordinate` = coordonnées de **notre** localisation (même piège que session 21). `hasActiveJob` étendu à `(locationId, competitorPlaceId=null)` — un job concurrent en cours ne bloque plus la synchro de la fiche elle-même, ni les autres concurrents. `pollRunningJobs`/`resolveJob` unifiés : un seul `tasks_ready` partagé, branche sur `competitor_place_id` vers `resolveCompetitorJob` (upsert `competitor_reviews`, snapshot `total_reviews_count`/`avg_rating` du dernier lot, garde-fou saturation incrémentale identique à session 21).

**Vérifié en conditions réelles** (3 vrais concurrents Atlasimmobilier/Marrakech, déjà suivis depuis G7) : le backend tournant en `nodemon` a **auto-rechargé le nouveau code et exécuté le flux de bout en bout automatiquement** dès l'écriture des fichiers — réconciliation → 3 lignes créées → 3 jobs backfill soumis (place_id concurrent + coordonnées Atlas acceptés par DataForSEO, **question ouverte §9 tranchée**) → **175 vrais avis concurrents importés** (12+140+23, $0.045 total, coût conforme au tarif standard depth 200). Isolation vérifiée : 0 interférence avec les jobs "ma fiche" (64 avis, inchangés). Aucune donnée de test à nettoyer (concurrents et avis 100 % réels).

### Détail session AC2 — Stats mensuelles (2026-07-03)

**Migration 50 (`locations.total_reviews_count`/`avg_rating`)** : la règle de complétude (§2.6 du cahier — "s'applique aussi à la série ma fiche") exige un total connu pour la fiche elle-même, symétrique à `review_competitor_tracking`. Capturé dans `resolveLocationJob` (comme `resolveCompetitorJob` le fait déjà pour un concurrent). ⚠️ Collision de numérotation bénigne avec la session retry du geogrid (elle aussi `20260703000050-*`, tables différentes, les deux ont migré sans conflit — Sequelize suit par nom de fichier complet).

**`getCompetitorStats(businessId, userId, locationId, year)`** : 4 requêtes SQL brutes (`sequelize.query`, replacements nommés) — mensuel + totaux pour "me" (`reviews`), mensuel + totaux pour les concurrents en une seule requête chacune (`place_id IN (:placeIds)`, sautée si aucun concurrent suivi). `complete_from` par série : mois ≤ au plus ancien avis stocké sont signalés potentiellement incomplets, sauf si `stored_count >= total_reviews_count` (snapshot API) — la fonction renvoie toujours 12 mois avec leur compte réel, c'est au frontend (AC3) de griser visuellement.

**Vérification empirique du risque fuseau horaire** (au lieu de supposer) : sondé en direct contre la vraie connexion Postgres de l'app — `SHOW timezone` → session **UTC** confirmée, et test croisé d'un avis à la frontière d'un mois (`date_trunc('month', '2026-01-31T23:30:00Z')` → `2026-01-01T00:00:00Z`, correct). Un correctif `AT TIME ZONE 'UTC'` envisagé aurait en réalité **introduit** un décalage d'un jour (`2025-12-31T23:00:00Z`, testé et rejeté) — code laissé tel quel, commenté pour dissuader une "correction" future erronée.

**2 findings de la revue adversariale (3 angles : dates/SQL, isolation, cas limites)** : le finding "fuseau horaire" (sévérité haute) reposait sur une hypothèse de fuseau non-UTC — invalidé par la vérification empirique ci-dessus, aucun changement de code. Le finding "`available_years` peut exclure l'année demandée si elle précède toutes les données" (sévérité moyenne) était réel — corrigé (l'année demandée est désormais toujours incluse dans la plage). Durcissement additionnel : `business_id` ajouté explicitement aux requêtes `competitor_reviews` (déjà sûr via `location_id` pré-vérifié, mais conforme à la règle CLAUDE.md "isolation stricte à chaque requête").

**Vérifié en conditions réelles** contre les données AC1 (Atlasimmobilier, 2 localisations distinctes — 39+25 avis "ma fiche" répartis dessus, 3 concurrents sur l'une d'elles) : agrégats mensuels 2025/2026 cohérents avec les vraies dates, `complete_from` correct dans les deux cas (`null` si backfill prouvé complet, sinon mois du plus ancien avis), fallback année invalide (`abc`) → année courante sans planter, localisation sans concurrent → série "me" seule sans requête SQL invalide, fix `available_years` confirmé (année 2019 hors plage de données bien incluse).

### Détail session AC3 — Frontend page Concurrents (2026-07-03) — **module complet**

**Backend (petit complément)** : gating (`getReviewsQuota`) ajouté à `getCompetitorStats` (absent d'AC2, nécessaire pour l'état "non inclus dans votre plan" du frontend) ; `last_synced_at` ajouté aux séries (`buildSeries` + sites d'appel) ; nouvelle fonction `triggerCompetitorSync(businessId, userId, locationId, placeId)` — réconcilie puis soumet un backfill **priority** (~1 min) pour un concurrent tout juste ajouté (symétrique à `triggerSync` pour "ma fiche"), route `POST /reviews/competitors/sync`.

**`ReviewsConcurrentsPage.jsx`** (`/reviews/concurrents`, sidebar AVIS) : bloc gestion (compteur quota `x/y` partagé avec le positionnement, `PlaceSearch` + suggestions détectées, liste avec note/total/dernière synchro/statut synchro en cours, suppression), carte « Ce mois-ci » (`MetricCard`, delta vs meilleur concurrent), sélecteur d'année, courbe 12 mois, tableau mensuel. `TrendChart` (`GeogridTrendChart.jsx`) étendu par props `yReversed`/`yLabel` (défauts inchangés = zéro régression sur les pages Positionnement).

**4 findings de la revue adversariale (contrat de données/logique JS — les 2 autres angles, régression et isolation/gating, n'ont rien trouvé), tous confirmés réels en relisant le code** :
1. Fetch redondant au chargement initial (le garde-fou par ref ne bloquait que le tout premier passage, pas la transition `year: null → valeur`) — corrigé en comparant directement `stats.year === year` (plus besoin de ref).
2. `currentMonthLabel` en fuseau local au lieu d'UTC (incohérent avec les labels du backend) — corrigé (accesseurs UTC).
3. Boucle de poll après ajout d'un concurrent sans `try/catch` par itération — un raté réseau transitoire faisait remonter une erreur alors que l'ajout avait réussi — corrigé (retry silencieux par tour).
4. **Collision de clé de courbe pour des concurrents homonymes** (`s.name` utilisé comme clé de données ET clé React) — pas un cas théorique : « Guy Hoquet », une enseigne en franchise, est un des 3 vrais concurrents suivis. Corrigé en étendant `TrendChart` : `dataKey`/`key` = `s.key` (place_id, toujours unique), nouveau prop `label` séparé pour l'affichage (légende/infobulle) — rétrocompatible (défaut `label || key`).

**Vérifié en conditions réelles** : redémarrage backend nécessaire en cours de vérif (l'ancien process servait du code d'avant le fix `last_synced_at`, symptôme repéré car "dernière synchro : jamais" pour 3 concurrents dont la base avait pourtant la vraie date — jamais fait confiance à l'écran sans vérifier la donnée réelle en base). Après redémarrage : page testée en preview avec les vraies données Atlasimmobilier — quota 3/3 correctement bloquant (« Limite de votre plan atteinte »), 3 concurrents affichés avec note/total/date réels, carte "Ce mois-ci" cohérente, courbe à **4 lignes** rendue sans collision (légende avec les 4 noms distincts, dont Guy Hoquet), tableau correct. Non-régression confirmée sur `/positionnement/suivi` (label "Position" intact, aucune erreur console). `ResponsiveContainer` de Recharts a mis ~2s à se mesurer en preview headless (comportement déjà documenté sur ce projet, pas un bug — confirmé identique sur les pages positionnement existantes).

**Refonte UX sur retours utilisateur (2026-07-03)** : (1) la carte « Ce mois-ci » affichait un seul concurrent (le meilleur, en sous-texte) → remplacée par une **grille de `MetricCard`** (Ma fiche + une par concurrent, comparatif du mois en un coup d'œil). (2) Réordonnancement demandé : cartes « ce mois-ci » → **courbe** → **tableau** → gestion des concurrents en bas. (3) **Pleine largeur** (retrait de `max-w-4xl`) + tableau `table-fixed` avec colonnes de résultats **proportionnelles** (la colonne « Ma fiche » n'est plus rétrécie). (4) **Charte de rang partagée extraite** dans `frontend/src/lib/rank-palette.js` (source unique : couleurs pleines + fonds doux + texte ; `lib/geogrid.js` la ré-exporte → zéro régression sur la carte/légendes, vérifié) ; cellules du tableau **colorées par classement relatif du mois** (leader = vert, dernier = rouge, entre-deux = orange) — plus discriminant que les seuils absolus top3/10/20 à faible nombre de concurrents, tout en réutilisant la même charte que la heatmap. Vérifié en preview sur données réelles (2025) : ex. Janvier Ma fiche=1 (rouge) vs Guy Hoquet=3 (vert), Juin Ma fiche=5 (vert) — le signal « qui gagne le mois » est correct ; non-régression `/positionnement/suivi` (légende `RANK_LEGEND` intacte) reconfirmée.

**2ᵉ vague de retours (2026-07-04)** : (5) **masquage des mois futurs** — année en cours → tableau + courbe jusqu'au mois courant inclus (`monthsToShow = year===currentYear ? getUTCMonth()+1 : 12`), année passée → 12 mois. (6) **charte enrichie** d'un bucket `top1` (vert foncé, distinct de `top3`) — le leader du mois l'utilise (nuance ajoutée aussi à `rankBucket` pour la carte : ≤1 top1 / ≤3 top3 / ≤10 mid / ≤20 low). (7) **« bug » ma fiche à zéro en 2026 — investigué et NON confirmé** : la fiche active « Atlasimmobilier Marrakech » (`ee087507`) a réellement **0 avis en 2026** (25 avis au total, le plus récent nov. 2025), **vérifié en LIVE contre Google via DataForSEO** (reviews_count=25, 10 plus récents tous 2025). Les avis 2026 de l'utilisateur sont sur une **2ᵉ fiche Atlas, Essaouira** (`f6284226`, 39 avis jusqu'à juin 2026, textes mentionnant « Atlas Immobilier Essaouira »). C'est le signal produit attendu : Marrakech 0 avis en 2026 pendant que les concurrents en ont 11-22. ⚠️ Pièges de vérif rencontrés : rate-limit backend épuisé par les appels rapides du pilotage preview → déconnexion (résolu par redémarrage backend) ; `activeLocation` retombe sur Essaouira après reconnexion (« 2 colonnes » transitoires, normal — Essaouira n'a qu'1 concurrent suivi). Vérifié en preview sur Marrakech : 4 cartes, tableau 7 mois (2026) / 12 (2025), coloration 3 teintes (Mars : Mardie 13 vert-leader / Guy Hoquet 4 orange / FJ 1 rouge). (8) **Cumul annuel sur les cartes** puis (9) **cartes pilotées par le select d'année** (retour : les cartes ne s'affichaient que pour l'année en cours et disparaissaient en changeant d'année) : la section devient « Avis reçus en {year} » et **suit le select** (année en cours ET passée), chaque carte affiche le **total de l'année sélectionnée** en chiffre principal (`meYear`/`compStats[].year` via `yearTotalOf`), le compte du mois en cours passe en sous-texte (année en cours uniquement) ; delta ma-fiche = total annuel vs meilleur concurrent. Vérifié en preview : 2026 → Ma fiche 0 / Mardie 22 / FJ 4 / Guy Hoquet 11 ; **select → 2025** → cartes maintenues, totaux Ma fiche 13 / Mardie 1 / FJ 8 / Guy Hoquet 39 (conforme base).

### Correctif transverse — isolation par localisation active (2026-07-04)

**Bug rapporté** (compte cogitowebnet, 2 localisations Atlasimmobilier Marrakech/Essaouira) : changer de localisation dans la sidebar ne changeait pas les données des pages Avis et Clients. Audit multi-agents complet (32 agents : code frontend/backend + données réelles en base + reproduction API) : la base était **saine** (25 avis Marrakech / 39 Essaouira, 0 mélange), le défaut était applicatif.

**Corrigé (implémentation parallèle, 4 sous-agents + Dashboard)** :
- `ReviewsPage` : câblée sur `activeLocation` (dropdown local « Toutes les localisations » supprimé, `location_id` systématique, re-fetch au changement).
- `customers` : migration **20260704000053** `customers.location_id` (FK nullable, NULL = visible sur toutes les fiches, index `(business_id, location_id)`) ; create/import CSV/list/stats filtrés + validation d'appartenance ; `CustomersPage` câblée.
- `invitations` : **bug réel** — `location_id` reçu/validé mais jamais persisté par l'envoi unitaire → corrigé (2 `Invitation.create`). Destinataires de campagne (`all`/`uninvited`) scoppés localisation-ou-NULL ; `GET /campaigns?locationId=` ; `InvitationsPage` câblée.
- `widgets` : `GET /widgets?location_id=` (widgets de la fiche + globaux, badge « Toutes les localisations ») ; builder pré-sélectionné sur la fiche active ; **faille corrigée** : `assertOwnership` (locationId/tagId cross-tenant acceptés sans vérification dans create/update/preview).
- `DashboardPage` : métriques par fiche active (avis collectés/note = snapshots `locations`, clients invités = stats filtrées).

**Vérifié en réel** : script API authentifié (25 vs 39 avis, ids disjoints, stats/campagnes/widgets par fiche) + preview navigateur (bascule sidebar Marrakech→Essaouira change bien la page Avis en live), 0 erreur console nouvelle. Pages déjà conformes non touchées (Positionnement ×3, Avis concurrents, QR Code, Page de collecte). **Findings d'audit restants — corrigés (2026-07-04)** :
- ✅ `POST /credits/add` : désormais protégé par `superAdminMiddleware` (middleware partagé `middlewares/super-admin.middleware.js`, 403 si `role !== 'superadmin'`).
- ✅ Index unique `reviews` : migration **20260704000054** remplace `(platform, external_id)` par `(location_id, platform, external_id)` — plus de vol/écrasement d'avis si 2 fiches partagent un place_id ; `conflictFields` de `Review.upsert` aligné (index vérifié en base réelle). `competitor_reviews` déjà scopé `(location_id, place_id, external_id)` → pas concerné.
- ✅ `business.middleware.js` : code mort confirmé (0 référence backend/frontend), fichier supprimé.

**Infra** : `.claude/launch.json` — `"autoPort": false` ajouté à la config `locagain-backend` (le backend doit rester sur le port 3000 : URLs frontend + callbacks OAuth en dur dessus ; un process node zombie tenait le port au redémarrage). ⚠️ Collision de numérotation **bénigne** avec une session concurrente (« Paramètres entreprise ») : deux migrations `20260704000054` (`-scope-reviews-unique-index-by-location` ici, `-add-settings-fields-to-businesses` là) — tables différentes, exécutées par ordre alphabétique de nom de fichier, aucune interférence (même cas que la collision `000050` documentée plus haut).

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
