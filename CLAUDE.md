# CLAUDE.md — Locagain — SaaS E-Réputation / Gestion des avis Google

## Réponses
- Réponses courtes et concises uniquement
- Pas de résumé en fin de réponse
- Pas de commentaires évidents dans le code
- Propose, n'implémente pas sans validation explicite

## Projet
SaaS multi-tenant de gestion de la e-réputation et des avis Google My Business.
Référence visuelle : interface Qwairy (dashboard admin, sidebar gauche, accent violet #7C5CFC).

Docs de référence :
- `CAHIER_CHARGES_MVP_EXTENSIBLE_FR.md` — cahier des charges complet
- `PLAN_SESSIONS.md` / `PROGRESS.md` — plan des sessions et historique détaillé
- `WIDGETS_DESIGN_FR.md` — design system widgets (catalogue, config, gabarits)
- `GEOGRID_DESIGN_FR.md` + `GEOGRID_REFONTE_FR.md` — suivi de positionnement (geogrid)
- `AVIS_CONCURRENTS_FR.md` — suivi des avis de la concurrence
- `MON_COMPTE_DESIGN_FR.md` — page Mon compte / profil & sécurité (session 31)

## Stack technique
- **Frontend** : React 18 + Vite, JavaScript (pas TypeScript), TailwindCSS, React Router, Axios, Zustand
- **Backend** : Node.js 18+ + Express.js, JavaScript
- **ORM** : Sequelize (migrations incluses)
- **Auth** : JWT + bcryptjs
- **BDD** : PostgreSQL — **prod : local au serveur** (Plesk), base `postgreGmb_` / user `gmbpostgre_user42` ; **dev : local au PC** (`localhost:5432/locagain`). ⚠️ Il n'y a **pas** de base OVH distante (l'ancien `CLAUDE.md` mentionnait à tort `ns3181892.ip-146-59-148.eu` comme hôte BDD — c'est le serveur d'hébergement, pas une BDD séparée).
- **Déploiement** : serveur OVH dédié `ns3181892` sous **Plesk + Phusion Passenger** (et non PM2/Nginx). Voir §Déploiement production.
- **Domaine** : **gmbmanager.ai** (prod). Le code reste nommé « locagain ».
- **Versioning** : GitHub — `periebastien/maxavy`

## Structure du projet
```
backend/src/modules/[module]/   ← auth, businesses, reviews, widgets...
frontend/src/pages/[Page]/
frontend/src/components/common/ ← composants réutilisables
```

## Conventions
- Fichiers : kebab-case
- API REST — routes préfixées `/api/v1/`
- Variables `.env` — jamais committées, jamais en dur
- Isolation stricte par `business_id` à chaque requête backend
- Données personnelles chiffrées AES-256-GCM (email, téléphone, tokens OAuth)
- Migrations : vérifier le dernier numéro existant AVANT d'en créer une (2 collisions déjà survenues entre sessions parallèles) — numérotation strictement croissante

## Commandes
```bash
# Backend (depuis backend/) :
node src/app.js          # démarrage dev
npm run dev              # nodemon (hot reload)

# Frontend (depuis frontend/) :
npm run dev              # port 5173
npm run build            # build prod
```

## Gestion des serveurs (2 process, 2 ports)
Deux serveurs distincts tournent en parallèle — ne jamais confondre :
- **Backend** — port **3000** (`node src/app.js` depuis `backend/`)
- **Frontend Vite** — port **5173** (`npm run dev` depuis `frontend/`)

**Redémarrer le backend moi-même** à chaque fois que nécessaire (nouvelles routes, modif `app.js`, nouveau module, changement dans un module backend comme `widget.runtime.js`, etc.) :
1. Tuer **uniquement** le process du port concerné : `Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | Select-Object -First 1` → récupérer le PID, puis `Stop-Process -Id <PID> -Force` (remplacer `3000` par `5173` pour le frontend)
2. **Ne jamais faire `Get-Process node | Stop-Process`** — ça tue les DEUX serveurs (backend 3000 **et** Vite 5173)
3. Relancer : backend `cd backend && node src/app.js` en arrière-plan ; frontend (si mort par erreur) `cd frontend && npm run dev` en arrière-plan
4. Vérifier les logs backend : `PostgreSQL connecté` et `[cron] Job invitations planifiées démarré`

Note : le frontend Vite a du hot-reload (HMR) → il redémarre rarement ; le backend, lui, doit être relancé à la main après toute modif backend.

## Déploiement production (Plesk + Passenger) — en ligne depuis 2026-07-11
Serveur OVH dédié `ns3181892`, **Plesk**, domaine **gmbmanager.ai** (HTTPS Let's Encrypt).
- **Moteur** : Phusion **Passenger** (une seule appli Node par domaine ; **pas** de PM2/Nginx custom). Application Root `/httpdocs/backend`, Startup File `src/app.js`, Application Mode `production`, Document Root `/httpdocs/backend/public`.
- **Contrainte Passenger** : le Document Root doit être un **sous-dossier** de l'Application Root → d'où `backend/public`.
- **Front servi par le backend** : `app.js` sert les fichiers statiques de `backend/public` + `app.get('*')` (fallback SPA React Router). CSP helmet **désactivée** (`contentSecurityPolicy: false`) car Google Maps/OAuth chargent depuis des domaines tiers.
- **Variables d'env** : fichier **`/httpdocs/.env`** (chargé par app.js via `../../.env`, situé **au-dessus** du doc root → non exposé au web) **+** overrides dans « Variables d'environnement personnalisées » de Plesk (`NODE_ENV=production`, `GOOGLE_CALLBACK_URL`/`GOOGLE_BUSINESS_REDIRECT_URI` en https, `APP_URL`, `STORAGE_PATH`). `dotenv` **n'écrase pas** une var déjà définie → les overrides Plesk priment sur le fichier.
- **BDD** : PostgreSQL **local** — `DATABASE_URL=postgresql://gmbpostgre_user42:<mdp>@localhost:5432/postgreGmb_`, **sans SSL**. Le SSL est piloté par **`DB_SSL`** (`=true` seulement pour une base managée distante), plus par `NODE_ENV` (sinon une base locale sans SSL casse au boot).
- **Anti-double-cron** : `startCronsIfPrimary()` dans app.js prend un verrou consultatif Postgres (`pg_try_advisory_lock`) sur une connexion dédiée non relâchée → une seule instance lance les crons. **Garder l'app en 1 instance** Passenger.
- **Déploiement continu** : **Plesk Git** (dépôt `periebastien/maxavy`, branche `main`, chemin `/httpdocs`). Front modifié → `cd frontend && npm run deploy:build` (build vite + copie auto dans `backend/public`), commit, puis **Git pull + Restart App** côté serveur (+ **NPM install** si nouvelle dépendance backend).
- **Migration initiale des données** : dump `pg_dump --no-owner --no-acl` restauré via `psql` (lancé depuis une **tâche planifiée Plesk**, pas de phpPgAdmin sur ce serveur).
- **Restant prod** : basculer les URIs OAuth Google + le webhook Stripe sur `https://gmbmanager.ai`.

## État du projet (résumé — historique complet : `PROGRESS.md`)
Mise à jour : 2026-07-11.
- **🚀 Mise en ligne (2026-07-11)** : appli en prod sur **https://gmbmanager.ai** (Plesk + Passenger, PostgreSQL local). Voir §Déploiement production ci-dessus.
- **Terminé et vérifié** : auth/OAuth Google, onboarding, collecte publique + QR, clients (chiffrement + consentement), invitations/campagnes (Brevo OK, Twilio stub), lecture des avis via DataForSEO (GMB abandonné en lecture, module `google/` OAuth inerte), widgets (5 styles, builder, anti-fuite), crédits/plans/Stripe (webhooks), geogrid complet G1→G13 (wizard config, suivi, concurrents, cron résilient retry 3 niveaux + circuit-breaker, portail débit DataForSEO partagé), avis concurrents AC1→AC3, panel Super Admin `/admin/*` (plans/comptes/modules/**planning**/**crédits**), paramètres entreprise, gestion d'équipe (session 30), **profil & sécurité (session 31 — page `/account`)**, **facturation par propriétaire + packs/coûts crédits (session 32b)**, responsive admin, correctif transverse isolation par localisation.
- **Session 32b — Facturation par propriétaire (2026-07-11)** : plan et pool de crédits portés par le **user owner** (`users.plan_id`/`credit_balance`/`stripe_*`, migration 57 avec backfill ; `businesses.plan_id`/`credit_balance` = colonnes mortes, ne plus JAMAIS les lire). Résolution du plan : toujours via `backend/src/services/plan-resolver.js` (fallback Gratuit). Débits atomiques sur l'owner ; table `credits` garde `business_id` (audit). Packs de crédits en base (`credit_packs`, checkout Stripe les lit) + coûts configurables (`credit_costs` : email=1, SMS=5, WhatsApp=5, geogrid_point=2 ; lecture via `services/credit-costs.js`, cache 60s). Module `admin-credits/` + onglet Super Admin « Crédits ». **Le geogrid débite** : coût × points au lancement (`submitScanForKeyword`), jamais re-débité en retry ; solde insuffisant → 402 manuel / scan `failed` terminal en cron. `GET /admin/accounts` groupé par owner ; `PUT /admin/accounts/owner/:userId/plan`.
- **Restant** : G11 (rapport email geogrid + consommation du hook `notify_failure`), Stripe prod (`stripe_price_id` des plans vides), pages légales/RGPD (mises de côté volontairement — à faire avec la partie visible du site), ops (PM2/Nginx/SSL, backups, monitoring, `/health`), tests automatisés/CI.
- **Session 31 — Profil & sécurité terminée (2026-07-10)** : cahier `MON_COMPTE_DESIGN_FR.md`. Page `/account` (Profil / Sécurité / Mes entreprises), `PATCH /auth/me` (whitelist), `PUT /auth/me/password` (401 mdp faux, 400 compte Google, email notif Brevo), `my_role` dans `GET /businesses`, aucune migration. Piège corrigé : un 401 métier sur `/auth/me/password` déclenchait le logout centralisé → route ajoutée à `AUTH_PATHS` dans `frontend/src/lib/api.js`. v2 au cahier : changement email, mdp pour comptes Google, suppression compte (RGPD), 2FA, upload avatar.
- **Session 22 (répondre aux avis) — mise de côté (décision 2026-07-06)** : DataForSEO est lecture seule (vérifié dans la doc officielle : `task_post` = tâche de collecte, ne publie rien). Ne sera développée que si un accès API Google Business Profile est obtenu. Le jour venu : fournisseur IA configurable depuis le Super Admin (Claude/OpenAI/autre), clé en `.env`.
- **Sécurité (audit 2026-07-06)** : correctifs appliqués (webhook Stripe raw body, CORS+rate limit routes publiques widgets, JWT HS256 explicite, `requireRole` front, 401 centralisé). Dette restante : JWT en localStorage → cookie httpOnly à planifier.
- **`business_modules`** : écrit par le panel admin mais lu par aucun module métier (gating réel = `plans.module_quotas`) — à consommer plus tard.
- ℹ️ Compte cogitowebnet@gmail.com (owner d'Atlasimmobilier, plan Agence sur `users.plan_id`) : **conservé volontairement** — c'est le compte de travail de l'utilisateur (ses vrais clients + tests prod sur plusieurs semaines). **Ne pas reverter le plan.**
- **Session 30 — Gestion équipe terminée (2026-07-06)** : module `modules/team/` (`GET /team`, `POST /team/invite`, `POST /team/accept` public, `PUT /team/:id/role`, `DELETE /team/:id`). Table `team_members` (ENUM `admin`/`editor`/`viewer`) réutilisée depuis la migration 8 (aucune migration destructive). **Migration additive 56** `team_invitations` pour les invités **sans compte** (email chiffré AES-256-GCM + `email_hash` SHA-256 lookup + `token_hash` SHA-256 ; token `randomBytes(32)`, jamais en clair, TTL 7 j). **Enforcement des rôles** rétrocompatible : `assertAccess(business, userId, { write })` — owner (aucun `TeamMember`) garde tous ses droits (non-régression stricte), membre non accepté rejeté, `viewer` bloqué en écriture ; `{ write: true }` appliqué à customers/campaigns/invitations/widgets/reviews. Settings restent `owner_id`-only. **Frontend** : section « Équipe » dans `SettingsPage` (`components/settings/TeamSection.jsx`) + page publique `/invitation` (`AcceptInvitationPage.jsx`). Testé réel **28/28 PASS**, non-régression owner OK, données de test nettoyées. **Complément (2026-07-08)** : 4ᵉ onglet Super Admin « Planning » (`admin-schedule/`, `GET /admin/schedule/geogrid-month`) — vue cross-tenant en lecture seule des rapports geogrid prévus ce mois-ci, toutes entreprises confondues. Fix associé : `BusinessContext.jsx` avait un état `isLoading` qui ne se réinitialisait pas correctement entre deux connexions (sentinelle `null` vs `[]` ajoutée). Prochaine session : **31 — Profil & sécurité** ou **G11 — Rapport email (v1)**.

## Pièges connus (ne pas re-découvrir)
- **DataForSEO** : `location_coordinate` obligatoire même avec `place_id` (sinon `40501 Invalid Field: location_name`) ; facturation au `depth` ; ne **publie pas** de réponses aux avis (lecture seule) ; file standard en auto, priority pour les actions manuelles.
- **Tout appel DataForSEO** passe par le portail global `backend/src/services/dataforseo-gate.js` (débit/concurrence partagés geogrid + avis, sous-plafond `tasks_ready` 60/min) — ne jamais appeler l'API en direct depuis un provider.
- Modèle `Review` : `updatedAt: false` (colonne absente en table — l'oublier casse toute lecture d'avis).
- Sequelize renvoie `createdAt` (camelCase), pas `created_at` → piège « Invalid Date » côté front.
- Buckets de dates côté front : jamais `toISOString()` (décalage UTC) — clés en composants de date locaux (`frontend/src/lib/geogrid-trend.js`).
- Convention `run_day_of_week` : 0=dimanche…6=samedi (alignée `schedule.utils.js`, Luxon).
- Connexion Postgres en **UTC** : `date_trunc` correct tel quel — ne PAS ajouter `AT TIME ZONE 'UTC'` (introduirait un décalage d'un jour ; testé et rejeté en AC2).
- Si l'écran contredit la base : backend probablement désynchronisé (nodemon pas rechargé) → redémarrer le backend avant de chercher un bug.
- Carte Google Maps et événements internes Recharts ne se testent pas en preview headless — pas un bug, vérifier en vrai navigateur.
- Charte de couleurs de rang partagée : `frontend/src/lib/rank-palette.js` (source unique, ré-exportée par `lib/geogrid.js`).
- **Widgets embarqués (embed sur sites clients)** : les routes publiques (`/:id/embed.js`, `/runtime.js`, `/:id/public`) DOIVENT renvoyer `Cross-Origin-Resource-Policy: cross-origin` — helmet met `same-origin` par défaut, ce qui bloque le chargement des scripts depuis un autre domaine (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, widget invisible sans erreur console). Corrigé dans `widget.controller.js`.
- **`widgets.embed_code`** est **dérivé** de `APP_URL` **à la lecture** (jamais figé en base) — sinon un widget créé en dev puis importé en prod (dump) garde une URL `localhost`. Voir `withEmbedCode()` dans `widget.service.js`.
- **Google Sign-In** : helmet doit être configuré avec `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }` dans `app.js`. Le COOP `same-origin` par défaut coupe `window.opener` avec la popup Google → `Cannot read properties of null (reading 'postMessage')`. Prérequis aussi : `https://gmbmanager.ai` (+ `www`) dans les **Origines JavaScript autorisées** du client OAuth Google.

## Fin de session — checklist obligatoire
À chaque fin de session :
1. Mettre à jour `PROGRESS.md` — ligne de la session passée `⬜` → `✅` avec notes courtes
2. Mettre à jour `CLAUDE.md` — bloc « État du projet » (résumé court uniquement, le détail va dans `PROGRESS.md`)
3. Mettre à jour `PLAN_SESSIONS.md` + §11 du cahier si un module/une session a été ajouté(e)
4. **Committer la session** (jamais laisser plusieurs sessions non committées)

## Règles de développement
- Chaque module = dossier indépendant (`routes.js` + `controller.js` + `service.js`)
- Ajouter un module = nouveau dossier + entrée `business_modules`, jamais de refonte
- Tests : contre une vraie base PostgreSQL, jamais de mock
- Super Admin : periebastien@gmail.com
