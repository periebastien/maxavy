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

---

## Résumé
- **36 sessions** pour le MVP complet
- **Ensuite** : Module "Suivi des avis de la concurrence" (priorité 1 post-MVP)
