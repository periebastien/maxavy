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

## Gestion du backend
- **Redémarrer le backend moi-même** à chaque fois que c'est nécessaire (nouvelles routes, modification de app.js, nouveau module, etc.)
- Tuer **uniquement** le process sur le port 3000 : `Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | Select-Object -First 1` → récupérer le PID, puis `Stop-Process -Id <PID> -Force`
- **Ne jamais faire `Get-Process node | Stop-Process`** — ça tue aussi le serveur Vite frontend (port 5173)
- Si le Vite est mort par erreur : `cd frontend && npm run dev` en arrière-plan
- Relancer le backend : `cd backend && node src/app.js` en arrière-plan
- Vérifier que les logs affichent `PostgreSQL connecté` et `[cron] Job invitations planifiées démarré`

## État du projet (mise à jour 2026-06-30)
Sessions 1–26 terminées. Phase 7 complète. Phase 6 bloquée (quota GMB = 0, projet Cloud non vérifié).
Phase 6 (sessions 21–22) : code complet mais en attente déblocage quota `mybusinessaccountmanagement.googleapis.com`. Migration 19 (`reply_time`) à appliquer quand débloqué.
Phase 8 — sessions 26, 26b, 27 terminées (widgets backend + tags + carrousel/badge runtime + builder). Session 28 largement couverte en 27 (reste : polish badge, grep anti-fuite, « lire plus »).
Design system widgets (catalogue 5 widgets + modèle de config + gabarits) : **`WIDGETS_DESIGN_FR.md`**.
Responsive (2026-07-01) : cahier des charges §8.7 ajouté (full responsive, mobile-first) + **admin rendu full responsive** (sidebar en drawer + burger, grilles adaptatives) — session 33 partielle (reste états vides/loaders). Compte de test preview en mémoire.
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
