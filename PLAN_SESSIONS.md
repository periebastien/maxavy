# PLAN DES SESSIONS — Locagain MVP

Chaque session = 1 tâche précise, validée avant de passer à la suivante.

---

## PHASE 1 — FONDATIONS (Semaine 1)

| # | Session | Contenu |
|---|---------|---------|
| 1 | Init projet | Structure dossiers, Git, .gitignore, package.json backend + frontend |
| 2 | Config backend | Express, Sequelize, connexion PostgreSQL, variables d'env |
| 3 | Config frontend | Vite + React, TailwindCSS config (palette Qwairy), React Router |
| 4 | Composants de base | Button, Card, Badge, MetricCard, layout sidebar + topbar (squelette) |
| 5 | Sécurité fondations | Helper chiffrement AES-256-GCM, Helmet.js, rate limiting, migrations DB initiales |

## PHASE 2 — AUTHENTIFICATION (Semaine 2)

| # | Session | Contenu |
|---|---------|---------|
| 6 | Backend auth | Inscription, connexion, JWT, bcrypt, middleware auth |
| 7 | Frontend auth | Pages Login / Register, AuthContext, routes protégées |
| 8 | Mot de passe oublié | Flow reset par email (token + expiration) |

## PHASE 3 — ENTREPRISES & LOCALISATIONS (Semaine 3)

| # | Session | Contenu |
|---|---------|---------|
| 9 | Backend entreprises | CRUD entreprises + localisations, slug auto, Google Places autocomplete |
| 10 | Frontend entreprises | Formulaire création/édition, sélecteur entreprise active |
| 11 | Layout principal | Sidebar complète (sections, compteurs), topbar, navigation modulaire |

## PHASE 4 — DASHBOARD & COLLECTE (Semaine 4)

| # | Session | Contenu |
|---|---------|---------|
| 12 | Dashboard | KPIs 30j, liste derniers avis, lien collecte copiable, zone modules futurs |
| 13 | Page collecte publique | Route /avis/[slug-entreprise]/[slug-localisation], formulaire public, logique note ≥4 / <4 |
| 14 | Réglages page collecte | Interface admin (branding, rating, classic review, SEO, redirection externe) |
| 15 | QR Code | Génération automatique, téléchargement PNG/SVG, logo entreprise |

## PHASE 5 — CLIENTS & INVITATIONS (Semaine 5)

| # | Session | Contenu |
|---|---------|---------|
| 16 | Backend clients | CRUD clients, chiffrement email/téléphone, consentement horodaté |
| 17 | Import CSV | Upload + validation + case consentement obligatoire + blocage si non coché |
| 18 | Frontend clients | Liste clients, statuts, ajout individuel, import CSV |
| 19 | Invitations | Envoi email (Brevo) + SMS (Twilio), décrémentation crédits |

## PHASE 6 — AVIS GOOGLE (Semaine 6)

| # | Session | Contenu |
|---|---------|---------|
| 20 | OAuth Google | Flow OAuth Business Profile, stockage token chiffré |
| 21 | Sync avis | Récupération avis via API, cron quotidien, stockage en base |
| 22 | Interface avis | Liste avis (auteur, note, date, statut), filtres, réponse aux avis |

## PHASE 7 — CRÉDITS & STRIPE (Semaine 7)

| # | Session | Contenu |
|---|---------|---------|
| 23 | Backend crédits | Table credits, décrémentation par action, middleware checkCredits |
| 24 | Stripe abonnements | Plans Gratuit/Starter/Pro, webhooks, recharge mensuelle auto |
| 25 | Achat crédits | Packs à la carte, page facturation, historique |

## PHASE 8 — WIDGETS (Semaine 8)

| # | Session | Contenu |
|---|---------|---------|
| 26 | Backend widgets | CRUD widgets, config JSON, génération embed code |
| 27 | Widget carrousel | Composant JS embeddable (carrousel d'avis) |
| 28 | Widget badge | Badge de note moyen, interface personnalisation |

## PHASE 9 — FINITIONS (Semaine 9)

| # | Session | Contenu |
|---|---------|---------|
| 29 | Paramètres entreprise | Infos générales, notifications, slug |
| 30 | Gestion équipe | Invitation membres par email, rôles (admin/éditeur/lecteur) |
| 31 | Profil & sécurité | Page profil utilisateur, changement mot de passe |
| 32 | Super Admin | Panel admin global (tous les comptes, activation modules) |
| 33 | Polish UI | Responsive mobile, messages d'erreur, états vides, loaders |

## PHASE 10 — DÉPLOIEMENT (Semaine 10)

| # | Session | Contenu |
|---|---------|---------|
| 34 | Tests & corrections | Tests des flux critiques, correction des bugs |
| 35 | Config OVH | PM2, Nginx reverse proxy, variables d'env prod |
| 36 | Déploiement | Build prod, mise en ligne, SSL Let's Encrypt, tests finaux |

## PHASE 11 — SUIVI DE POSITIONNEMENT (GEOGRID) — *post-MVP*

> Heatmap de classement local Google Maps par grille GPS. Spec socle : `GEOGRID_DESIGN_FR.md` + cahier §9.5.
> **Refonte UX + fonctionnelle (wizard + suivi + concurrents + rapport email)** : cahier des charges dédié **`GEOGRID_REFONTE_FR.md`**.
> Décisions actées : source **DataForSEO** (pas de proxys côté nous), **gating par plan** (Gratuit exclu ; plafonds **éditables en Super Admin**), périmètre **complet** (grille config wizard + heatmap + multi mots-clés + concurrents + timeline + rapport email).

**Socle livré (G1→G4)** — grille, provider, cron, heatmap, métriques historisées, gating :

| # | Session | Contenu |
|---|---------|---------|
| G1 | Backend — schéma & grille | ✅ Fait (2026-07-01) — voir `PROGRESS.md` Phase 11 |
| G2 | Backend — provider & scan | ✅ Fait (2026-07-01) — testé avec un vrai scan DataForSEO, voir `PROGRESS.md` Phase 11 |
| G3 | Backend — cron & poll | ✅ Fait (2026-07-01) — boucle 90s scalable, testée cron réel de bout en bout, voir `PROGRESS.md` Phase 11 |
| G4 | Frontend — heatmap | ✅ Fait (2026-07-01) — `GeogridPage` + `GeogridMap`, gating/mots-clés/scan+polling/métriques. Carte non vérifiable en preview headless (rendu OK en vrai navigateur). Voir `PROGRESS.md` Phase 11 |

**Refonte « Positionnement » (G5→G12)** — détail complet dans `GEOGRID_REFONTE_FR.md` :

| # | Session | Contenu |
|---|---------|---------|
| G5 | Refonte modèle & config partagée | ✅ Fait (2026-07-02) — migration **additive** (4 nouvelles tables, `config_id`/`run_id`/top3-10-20, migration de données, quotas enrichis sans retirer les anciennes clés). Zéro régression vérifiée (DB réelle + preview). Cutover reporté à G6 (indissociable, voir `GEOGRID_REFONTE_FR.md` §16). Voir `PROGRESS.md` Phase 11. |
| G6 | Backend — planning & grille cercle | ✅ Fait (2026-07-02) — cutover complet : masque disque, `next_run_at` fuseau-aware (Luxon), cron réécrit par runs/configs, retrait des champs legacy du mot-clé, `/grid-preview` étendu. Vérifié en direct (dont un vrai cycle run→scan DataForSEO). Voir `PROGRESS.md` Phase 11. |
| G7 | Backend — concurrents & agrégats | ✅ Fait (2026-07-02) — CRUD concurrents (quota par localisation), agrégats fiche+concurrents (top 3/10/20 + backfill historique), `MAX_COMPETITORS` 5→20, endpoints `config`/`competitors`/`runs`/`trend`. Vérifié en direct (dont un vrai `POST /runs`). Voir `PROGRESS.md` Phase 11. |
| G8 | Frontend — Configuration (wizard) | Section sidebar « POSITIONNEMENT » **anticipée** (2026-07-02, nav seule). Reste : assistant 4 étapes (grille / mots-clés / planning / concurrents), édition pré-remplie, « premier rapport maintenant ». |
| G9 | Frontend — Suivi | Vue globale + vue par mot-clé (lecture seule), tableaux triables (fiche + concurrents), heatmap réutilisée, courbes **Recharts** (période + jour/semaine/mois + moyenne/meilleure). |
| G10 | Frontend — Concurrents | Page de comparaison vs concurrents (tableau + courbes de comparaison), sélection depuis concurrents détectés. |
| G11 | Rapport email (v1) | Config email (destinataires, cadence bornée par plan), génération résumé chiffré + lien, envoi à la fin d'un run. |
| G12 | Super Admin — quotas `rank_tracking` | Édition des plafonds par plan (mots-clés, dimension, formes, fréquences, concurrents) via `plans.module_quotas` — sans redéploiement (cf. cahier §10). |

> *v2 ultérieure* : rapport **PDF** avec courbe (SVG généré côté serveur).

---

## Résumé
- **36 sessions** pour le MVP complet
- **Ensuite (post-MVP)** :
  - Module « Suivi des avis de la concurrence » (priorité 1)
  - Module « Suivi de positionnement (geogrid / heatmap) » — socle **G1→G4** livré, refonte **G5→G12** (Phase 11 ci-dessus ; `GEOGRID_REFONTE_FR.md` + `GEOGRID_DESIGN_FR.md` + cahier §9.5)
