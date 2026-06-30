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

## État du projet (mise à jour 2026-06-30)
Sessions 1–18 terminées. Phase 5 en cours (16 ✅ 17 ✅ 18 ✅).
Prochaine session : **19 — Invitations** (email Brevo + SMS Twilio, décrémentation crédits).
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
