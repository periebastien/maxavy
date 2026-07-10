# MON COMPTE — Cahier des charges (Session 31 — Profil & sécurité)

Rédigé le 2026-07-10. Statut : **validé le 2026-07-10** (décisions en §8) — prêt pour développement.

---

## 1. Contexte & objectif

Page « Mon compte » = paramètres **au niveau utilisateur** (`user`), transverse aux entreprises.
À ne pas confondre avec `/settings` qui est au niveau **entreprise** (`business`).

Point d'entrée : le menu compte en bas de sidebar (`AccountMenu` dans `frontend/src/components/layout/Sidebar.jsx`), dont l'entrée « Mon compte » est aujourd'hui désactivée (« bientôt »).

Références existantes :
- Cahier des charges §Module 1 : « Page "Mon profil" (prénom, nom, email, téléphone, avatar) »
- Cahier des charges §Module 10 : « Sécurité (changement mot de passe) »
- `PLAN_SESSIONS.md` session 31 : « Page profil utilisateur, changement mot de passe »

## 2. État des lieux (vérifié dans le code, 2026-07-10)

### Déjà en place — à réutiliser
| Élément | Où | Note |
|---|---|---|
| Modèle `User` complet | `backend/src/models/User.js` | `firstname`, `lastname`, `phone`, `avatar_url`, `email_verified`, `google_id`, `auth_provider` — **aucune migration nécessaire** |
| `GET /api/v1/auth/me` | `backend/src/modules/auth/` | Retourne le profil sanitisé (sans `password_hash` ni `google_id`) |
| Reset password par email | Session 8 — `auth.service.js`, `ResetPasswordPage.jsx` | Token JWT 1 h + Brevo |
| Avatar Gravatar | `frontend/src/lib/gravatar.js` | Fallback initiales ; les comptes Google ont `avatar_url` (photo Google) |
| Emails Brevo | `backend/src/services/mail.service.js` | SMTP nodemailer, HTML inline |
| Multi-entreprises | `BusinessContext.jsx` + `team_members` | Un user peut être owner et/ou membre de plusieurs entreprises |

### Manquant — objet de cette session
- Aucune route de mise à jour du profil ni de changement de mot de passe.
- Aucune page front `/mon-compte` (aucune route dans `App.jsx`).

### Cas particulier structurant : comptes Google OAuth
Un compte créé via Google a `password_hash: null` et `auth_provider: 'google'` ; le login local lui est refusé. La section Sécurité doit gérer ce cas (voir 3.3).

## 3. Périmètre v1

Page **`/account`** (route protégée), activée depuis `AccountMenu` (retirer « bientôt »).
Layout : même gabarit que `SettingsPage` (sections empilées ou onglets — reprendre le pattern existant).

### 3.1 Section Profil
- Champs éditables : `firstname`, `lastname`, `phone`.
- `email` : **lecture seule en v1** (le changer impose une re-vérification + impacts login/Gravatar → v2).
- Avatar : affichage seul (Gravatar ou photo Google). Pas d'upload en v1 ; un texte indique que l'avatar vient de Gravatar (lien gravatar.com) ou de Google.
- Bouton « Enregistrer » → `PATCH /api/v1/auth/me` → rafraîchir `AuthContext` (le nom en bas de sidebar doit se mettre à jour sans re-login).

### 3.2 Section Sécurité — changement de mot de passe
- Formulaire : mot de passe actuel + nouveau + confirmation.
- Règles : min 8 caractères (aligner sur la règle du register existant), nouveau ≠ actuel.
- `PUT /api/v1/auth/me/password` : vérifie l'actuel via bcrypt, re-hash, **envoie un email de notification Brevo** (« votre mot de passe a été modifié — si ce n'est pas vous… »).
- Le JWT courant reste valide (pas d'invalidation de sessions en v1 — noté en v2).

### 3.3 Section Sécurité — cas compte Google
- Si `auth_provider === 'google'` et pas de `password_hash` : masquer le formulaire de changement, afficher « Connexion gérée par Google ».
- **« Définir un mot de passe » reporté en v2** (pas de mot de passe actuel demandé, permettra le login local en plus de Google).

### 3.4 Section Mes entreprises (lecture seule)
- Liste des entreprises accessibles avec le rôle de l'utilisateur : **Propriétaire** (owner) ou rôle `team_members` (admin / éditeur / lecteur).
- Réutilise les données déjà chargées par `BusinessContext` (+ rôle à exposer si absent de `/api/v1/businesses`).
- Pas d'action en v1 (quitter une équipe → v2).

## 4. API

Extension du module `auth` existant (pas de nouveau module métier : c'est du niveau `user`, hors gating `business_modules`).

| Route | Rôle | Corps |
|---|---|---|
| `PATCH /api/v1/auth/me` | Update profil | `{ firstname, lastname, phone }` — whitelist stricte, jamais `email`/`role`/`password_hash` |
| `PUT /api/v1/auth/me/password` | Changement mdp | `{ current_password, new_password }` — 401 si actuel faux ; cas « définir » : accepté seulement si `password_hash` null |

- Rate limit sur `/me/password` (réutiliser le limiter des routes sensibles).
- Réponses toujours sanitisées (pattern `sanitize()` existant).

## 5. Frontend

- `frontend/src/pages/AccountPage/` (suivre la convention des pages existantes).
- Composants sections dans `frontend/src/components/account/` (pattern `components/settings/TeamSection.jsx`).
- Route protégée dans `App.jsx` + activation de l'entrée dans `AccountMenu`.
- Après update profil : `AuthContext.refresh()` (ou setUser avec la réponse).

## 6. Hors périmètre v1 (v2 / sessions ultérieures)

- **Changement d'email** (re-vérification, impacts Gravatar/login).
- **Suppression de compte** (droit à l'oubli RGPD — à traiter avec les pages légales/RGPD, déjà planifiées ensemble ; cascade owner → entreprises à cadrer).
- **Vérification email à l'inscription** (cahier : optionnel).
- **2FA**.
- **Upload d'avatar fichier** (multer memoryStorage dispo, mais stockage disque/S3 à cadrer avec l'ops OVH).
- **Invalidation des sessions** après changement de mot de passe (lié à la dette JWT localStorage → cookie httpOnly).
- **Quitter une équipe** depuis « Mes entreprises ».

## 7. Critères d'acceptation (tests réels, vraie base)

1. Update prénom/nom/téléphone → persisté en base, nom mis à jour dans la sidebar sans re-login.
2. Changement mdp avec actuel faux → 401, aucun changement.
3. Changement mdp OK → ancien mdp refusé au login, nouveau accepté, email Brevo reçu.
4. Compte Google : formulaire mdp masqué (ou « définir un mot de passe » fonctionnel si retenu).
5. `PATCH /me` avec `role` ou `email` dans le corps → champs ignorés (whitelist).
6. Section « Mes entreprises » : owner et membre affichés avec le bon rôle.
7. Non-régression : login local, login Google, reset password, `/settings` intacts.

## 8. Décisions validées (2026-07-10)

1. Route : **`/account`**.
2. « Définir un mot de passe » pour les comptes Google : **v2** — v1 affiche « Connexion gérée par Google », formulaire masqué.
3. Section « Mes entreprises » : **incluse en v1** (lecture seule).
4. Layout : **sections empilées** (même pattern que la page Settings entreprise).
