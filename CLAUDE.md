# CLAUDE.md — Locagain — SaaS E-Réputation / Gestion des avis Google

## Réponses
- Réponses courtes et concises uniquement
- Pas de résumé en fin de réponse
- Pas de commentaires évidents dans le code
- Propose, n'implémente pas sans validation explicite

## Projet
SaaS multi-tenant de gestion de la e-réputation et des avis Google My Business.
Référence visuelle : interface Qwairy (dashboard admin, sidebar gauche, accent violet #7C5CFC).
Cahier des charges complet : `CAHIER_CHARGES_MVP_EXTENSIBLE_FR.md`

## Stack technique
- **Frontend** : React 18 + Vite, JavaScript (pas TypeScript), TailwindCSS, React Router, Axios, Zustand
- **Backend** : Node.js 18+ + Express.js, JavaScript
- **ORM** : Sequelize (migrations incluses)
- **Auth** : JWT + bcryptjs
- **BDD** : PostgreSQL sur serveur OVH (`ns3181892.ip-146-59-148.eu`)
- **Déploiement** : OVH dédié via PM2 + Nginx reverse proxy (pas de Vercel)
- **Domaine** : locagain.com
- **Versioning** : GitHub — periebastien

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

## État du projet (mise à jour 2026-07-01)
Sessions 1–26 terminées. Phase 7 complète. Phase 6 bloquée (quota GMB = 0, projet Cloud non vérifié).
Phase 6 (sessions 21–22) : code complet mais en attente déblocage quota `mybusinessaccountmanagement.googleapis.com`. Migration 19 (`reply_time`) à appliquer quand débloqué.
Phase 8 — sessions 26, 26b, 27 terminées (widgets backend + tags + carrousel/badge runtime + builder). Session 28 largement couverte en 27 (reste : polish badge, grep anti-fuite, « lire plus »).
Design system widgets (catalogue 5 widgets + modèle de config + gabarits) : **`WIDGETS_DESIGN_FR.md`**.
Suivi de positionnement (geogrid / heatmap Google Maps) — spec dans cahier §9.5 + **`GEOGRID_DESIGN_FR.md`**. Décisions : source = **DataForSEO** (identifiants `.env` en place et validés), facturation = **gating par plan** (Gratuit exclu, Starter bridé 5 mots-clés, Pro/Agence à ajuster). **Sessions G1, G2 et G3 terminées** (2026-07-01) : schéma + CRUD mots-clés (gating quota), provider DataForSEO (queue **Priority**) + `scan.service.js` (création/poll/finalisation) + endpoints scans, puis **cron** `jobs/scan-geogrid.js` (boucle `setInterval` 90 s : timeout + poll + lancement des mots-clés dus). Scalabilité (bcp de fiches) : lot `GEOGRID_BATCH_SIZE`/concurrence `GEOGRID_CONCURRENCY` bornés, pool PG relevé `DB_POOL_MAX`, détection « dû » via `geogrid_keywords.last_scanned_at`, timeout `GEOGRID_SCAN_TIMEOUT_MINUTES` — tous réglables dans `.env`. **Testé cron réel de bout en bout** (mot-clé → scan lancé et terminé en autonomie, 122 s). **Session G4 terminée** (2026-07-01) : `GeogridPage` (`/positionnement`, lazy) + `GeogridMap` (carte Google Maps, marqueur `Marker` legacy = pastilles de rang colorées + InfoWindow concurrents) + gestion mots-clés + gating par plan + scan avec **polling** (nouveau pattern front) + métriques ARP/ATRP/SoLV. Vérifié en preview avec données réelles (structure/metrics/API OK) ; la carte Maps ne se peint pas en preview **headless** (limitation navigateur automatisé, pas un bug — API Maps brute idem) mais rend en vrai navigateur. ⚠️ **Démo laissée** : Atlasimmobilier passée en plan Starter + 1 scan pour vérif visuelle utilisateur (reverter `plan_id`→null quand fini). Détail : `PROGRESS.md` Phase 11. **Refonte « Positionnement » cadrée (2026-07-02)** : cahier des charges dédié **`GEOGRID_REFONTE_FR.md`** (assistant de config en étapes : grille déplaçable + forme carré/cercle ; page Suivi lecture seule + courbes Recharts ; **concurrents** ; **rapport email** ; planning fin mensuel/hebdo/quotidien + fuseau par localisation, défaut = fuseau entreprise, éditable ; quotas plan **éditables Super Admin**, par localisation). Nouvelles sessions **G5→G12** (voir `PLAN_SESSIONS.md` Phase 11). ⚠️ L'UX G1→G4 (`GeogridPage`) est un socle, pas la cible finale. **Session G5 terminée (2026-07-02)** : migration **additive uniquement** (4 nouvelles tables `geogrid_configs`/`geogrid_competitors`/`geogrid_runs`/`geogrid_scan_competitors` + colonnes `config_id`/`run_id`/`points_top3-10-20` + migration des données existantes + quotas plan enrichis sans retirer les anciennes clés) — **zéro régression**, cutover reporté à G6. **Session G6 terminée (2026-07-02)** : cutover complet — grille cercle (masque disque, `buildGrid(...,shape)`), planning fuseau-aware (`schedule.utils.js`, lib **Luxon** ajoutée, `computeNextRunAt` testé 7 cas), cron réécrit par runs/configs (`findDueConfigs`/`launchRunForConfig`/`closeFinishedRuns` remplacent l'ancienne détection par mot-clé), auto-provisioning de config (`ensureConfigForLocation`), retrait définitif de `grid_size`/`grid_spacing_m`/`frequency`/`last_scanned_at` du mot-clé (migrations 40-41, `POST /scans` manuel inchangé). Vérifié en conditions réelles : cycle complet run→scan sur un vrai appel DataForSEO (grille 3×3 temporaire, coût minimal), 4 scénarios `closeFinishedRuns` en isolation, non-régression `/positionnement` confirmée en preview. **Sidebar « POSITIONNEMENT » anticipée de G8** (nav seule, 2026-07-02) : Configuration/Suivi/Concurrents, route renommée `/positionnement` → `/positionnement/configuration`. **Session G7 terminée (2026-07-02)** : CRUD concurrents (`competitor.service.js`, quota par config = par localisation), agrégats fiche+concurrents (top 3/10/20, `NOT_RANKED=21` imputé hors profondeur mesurée), `MAX_COMPETITORS` 5→20 (coût nul, profondeur déjà là), backfill des scans historiques, endpoints `GET/PUT /config` (édition stricte, plafonds du plan), `GET/POST/DELETE /competitors` + `/recompute`, `POST/GET /runs` (rapport manuel multi-mots-clés, `POST /scans` mono-mot-clé conservé pour l'UI actuelle), `GET /trend`. Quota mots-clés basculé par localisation (décision actée, différée depuis G5/G6). Vérifié en conditions réelles (dont un vrai `POST /runs`), données de test nettoyées, config restaurée à l'identique. **G8 découpé en 3 sous-sessions.** **G8.1 terminée (2026-07-02)** : 1ʳᵉ UI visible de la refonte — `StepIndicator` (réutilisable) + `GeogridConfigMap` (carte à marqueur central déplaçable) + `GeogridConfigPage` (wizard 4 étapes, **Étape 1 Grille complète** : carré/cercle, densité/espacement, compteur live points·couverture·coût, `PUT /config`). Routage : wizard sur « Configuration », ancienne `GeogridPage` déplacée sur « Suivi » (dégrisée) pour garder l'accès aux résultats jusqu'à G9. Vérifié en preview (49 pts carré → 29 cercle, save OK, config intacte). **Révisée sur retours utilisateur** (2026-07-02) : carte pleine largeur en haut / config dessous / stats à côté du bouton, points plus gros et foncés, coût en $ retiré, et surtout **cercle = disque des N² points les plus proches du centre** (49 points formant un vrai cercle, pas un carré — 2 itérations avant la bonne version). `GEOGRID_REFONTE_FR.md` mis à jour en conséquence. **Session G8.2 terminée (2026-07-02)** : Étape 2 (Mots-clés, reprise du pattern d'ajout/suppression existant) + Étape 3 (Planning : fréquence bridée par plan, heure/jour selon fréquence — convention `run_day_of_week` 0=dimanche..6=samedi alignée avec `schedule.utils.js` —, fuseau via la liste `TIMEZONES` déjà utilisée dans Onboarding/Settings), sauvegarde `PUT /config`, affichage du `next_run_at` recalculé. 100% frontend, aucun backend touché. Vérifié différemment cette fois : l'utilisateur a repris la main sur le serveur frontend (terminal manuel) donc pas de pilotage navigateur — vérifié via `esbuild` (syntaxe) + script Node authentifié contre l'API réelle (PUT /config mensuel → next_run_at juste, restauration exacte, cycle mot-clé propre). **Session G8.3 terminée (2026-07-02) — G8 complet.** Petit ajout backend annoncé : `GET /competitors/detected` (concurrents vus dans les 20 derniers scans, non suivis, triés par meilleur rang — testé en direct : 30 résultats réels). Étape 4 (Concurrents, optionnelle, skippable) : `PlaceSearch` réutilisé (remonté via `key` pour se réinitialiser entre deux ajouts, sans toucher au composant partagé) + puces de concurrents détectés. Étape 5 (Récap, pas un 5ᵉ point du stepper) : résumé des 4 dimensions avec liens « Modifier », bouton « Lancer un premier rapport maintenant » (`POST /runs`, chemin déjà prouvé en G7). Mode édition minimal : une fiche déjà configurée (≥1 mot-clé) atterrit direct sur le récap avec toutes les étapes déverrouillées (réutilise la logique existante du `StepIndicator`, aucun code dédié). L'ancienne `GeogridPage` reste sciemment à `/positionnement/suivi` — son retrait est repoussé à G9 (qui la remplace vraiment), pas cette session. Vérifié via `esbuild` + tests API réels (detected, cycle CRUD concurrents) ; entre-temps l'utilisateur a lui-même ajouté 4 mots-clés réels via l'Étape 2, confirmant G8.2 en conditions réelles. Prochaine session : **G9 — Frontend Suivi**.
Responsive (2026-07-01) : cahier des charges §8.7 ajouté (full responsive, mobile-first) + **admin rendu full responsive** (sidebar en drawer + burger, grilles adaptatives) — session 33 partielle (reste états vides/loaders). Compte de test preview en mémoire.
Widgets — polish badge (2026-07-01) : option `containerPadding` (marge intérieure), défaut `align` passé à `center`, « Propulsé par Locagain » toujours centré sous le badge (jamais flush sur son bord gauche/droit) — voir `WIDGETS_DESIGN_FR.md` §3.1.
Prochaine session : **28 (finitions widgets)** puis **29 — Paramètres entreprise**. Bug corrigé (2026-07-01) : modèle `Review` avait `updated_at` absent de la table → cassait toute lecture d'avis, fix `updatedAt: false`. Config Stripe (clés + stripe_price_id des plans) à faire séparément.
Voir `PROGRESS.md` pour le détail complet.

## Fin de session — checklist obligatoire
À chaque fin de session (avant le commit) :
1. Mettre à jour `PROGRESS.md` — ligne de la session passée `⬜` → `✅` avec notes courtes
2. Mettre à jour `CLAUDE.md` — bloc « État du projet » (sessions terminées, prochaine session)

## Règles de développement
- Chaque module = dossier indépendant (`routes.js` + `controller.js` + `service.js`)
- Ajouter un module = nouveau dossier + entrée `business_modules`, jamais de refonte
- Tests : contre une vraie base PostgreSQL, jamais de mock
- Super Admin : periebastien@gmail.com
