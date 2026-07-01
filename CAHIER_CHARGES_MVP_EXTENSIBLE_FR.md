# CAHIER DES CHARGES — SaaS de Gestion de la E-Réputation
## Version MVP Extensible

**Stack :** React + Node.js (Express) + PostgreSQL  
**Serveur :** OVH — `ns3181892.ip-146-59-148.eu` (Apache / Nginx / PostgreSQL / Node.js)  
**Objectif :** Lancer rapidement avec quelques clients, puis commercialiser en SaaS (freemium + crédits)  
**Principe directeur :** Tout doit être pensé pour grandir sans refonte

---

## 1. PRÉSENTATION DU PROJET

### 1.1 Objectif
Développer un SaaS multi-locataire (multi-tenant) de gestion de la e-réputation et du référencement local, permettant aux entreprises de :
- **Collecter** des avis clients (QR Code, email, SMS, WhatsApp)
- **Surveiller** leurs avis sur plusieurs plateformes
- **Afficher** leurs avis via des widgets sur leur site
- **Suivre** leur positionnement Google Business Profile (fonctionnalité ajoutée plus tard)
- D'autres modules viendront s'ajouter progressivement (voir section 9)

### 1.2 Modèle économique
- **Plan Gratuit** : crédits limités par mois, pour découvrir l'outil
- **Plans payants** (Starter / Pro / Agence) : abonnement mensuel avec crédits inclus
- **Crédits à la carte** : achat de packs supplémentaires
- **Usage interne d'abord** : utilisé sur quelques clients perso avant ouverture publique

### 1.3 Principe d'extensibilité (TRÈS IMPORTANT)

Le projet **doit être conçu dès le départ comme une plateforme à modules**, pas comme une application figée. Concrètement :

```
Chaque fonctionnalité future doit pouvoir se greffer SANS toucher au cœur du système.

Exemples de modules à venir (non développés au MVP, mais à anticiper) :
├─ Suivi de positionnement Google Business Profile (rank tracking local)
├─ Suivi des avis de la concurrence (à développer en priorité après le MVP)
├─ Audit SEO automatique de sites clients
├─ Génération de contenu IA (réponses aux avis, posts GBP)
├─ Marque blanche / Whitelabel pour agences
├─ Avis vocaux + transcription IA
├─ Module de facturation/devis pour les clients
├─ Rapports clients automatiques (PDF mensuel)
├─ Intégrations CRM (Zapier, Make.com)
└─ Application mobile (consultation rapide)
```

Pour permettre ça, l'architecture technique doit respecter dès le MVP :
- **Séparation stricte frontend/backend** (API REST découplée)
- **Architecture modulaire backend** (chaque fonctionnalité = un dossier de routes/contrôleurs/services indépendant)
- **Base de données pensée extensible** (tables génériques, pas de structure trop rigide)
- **Système de permissions/plans flexible** (facile d'ajouter un module = facile de le restreindre par plan)
- **Navigation frontend modulaire** (ajouter un menu = ajouter une route, pas une refonte)

➡️ **Concrètement pour Claude Code** : à chaque module développé, le code doit être écrit comme si on savait qu'un autre développeur (ou toi dans 6 mois) viendrait ajouter un module à côté sans tout casser.

---

## 2. STACK TECHNIQUE

### 2.1 Frontend
- **React 18+** avec **Vite** (build rapide)
- **JavaScript** (pas TypeScript pour rester dans ta zone de confort, possibilité de migrer plus tard)
- **TailwindCSS** (styling rapide et cohérent)
- **React Router** (navigation)
- **Axios** (appels API)
- **Context API** ou **Zustand** (state management léger)

### 2.2 Backend
- **Node.js 18+** + **Express.js**
- **JavaScript** (cohérence avec le frontend, tu connais déjà)
- **Sequelize** (ORM — supporte PostgreSQL nativement, syntaxe proche de SQL)
- **JWT** (authentification par token)
- **Bcryptjs** (hash des mots de passe)
- **node-cron** (tâches planifiées : sync Google, rapports, etc.)
- **Chiffrement applicatif** (module `crypto` natif Node.js, AES-256-GCM) pour les données personnelles sensibles avant écriture en base — voir section 12

### 2.3 Base de données
- **PostgreSQL** (à installer sur ton serveur OVH, remplace MariaDB)
- Migrations gérées via Sequelize (versionning du schéma)
- Choix justifié : meilleur support JSON natif (utile pour les champs `config`/`settings` des modules extensibles), meilleure gestion de la concurrence, standard pour les SaaS modernes

### 2.4 Services externes (au fil des phases)
- **Google Cloud** : OAuth, Business Profile API, Places API
- **Stripe** : abonnements + crédits à la carte
- **SendGrid** ou **Brevo** (ex-Sendinblue, français) : emails transactionnels
- **Twilio** : SMS + WhatsApp
- **Stockage local serveur OVH** : tous les médias (logos, futurs vocaux/vidéos) sont stockés directement sur le serveur, dans un dossier dédié hors racine web publique, avec sauvegardes régulières (voir section 12.4)

### 2.5 Déploiement
- **Serveur :** OVH `ns3181892.ip-146-59-148.eu`
- **Backend + Frontend** : Node.js tourne en arrière-plan via PM2 ; Apache ou Nginx fait le reverse proxy vers le port Node.js
- **Base de données** : PostgreSQL installé sur ce même serveur
- **Frontend** : build React servi statiquement par Nginx/Apache (pas besoin de Vercel, tout reste chez toi)

---

## 3. ARCHITECTURE GÉNÉRALE

### 3.1 Rôles utilisateurs

| Rôle | Description |
|---|---|
| **Super Admin (toi)** | Accès plateforme complète, gestion de tous les comptes, activation de modules par client — compte créé avec `periebastien@gmail.com` |
| **Propriétaire d'entreprise** | Gère une ou plusieurs entreprises et leurs localisations |
| **Membre d'équipe** | Accès limité, invité par email (rôles : admin/éditeur/lecteur) |
| **Agence** *(prévu, pas développé au MVP)* | Gère plusieurs comptes clients sous sa marque |

### 3.2 Multi-business & Multi-localisation

```
Compte Utilisateur
├── Entreprise A
│   ├── Localisation 1
│   └── Localisation 2
└── Entreprise B
    └── Localisation 1
```

Chaque entreprise a :
- Un slug unique (1er segment de l'URL publique de collecte)
- Un plan tarifaire et un solde de crédits propres
- Une liste de modules activés (voir section 9)

Chaque localisation (≥ 1 par entreprise) a :
- Sa **propre fiche Google** (`google_place_id` obligatoire) et donc ses propres avis
- Son **propre slug** (unique par entreprise) → sa page de collecte `/avis/[slug-entreprise]/[slug-localisation]` et son propre QR code
- C'est le **périmètre des modules cœur** : collecte, surveillance, invitations, QR, widgets s'appliquent par localisation

### 3.3 Principe d'isolation des données (multi-tenant)

Chaque enregistrement en base (avis, clients, widgets, etc.) est lié à un `business_id`. Aucune requête ne doit pouvoir retourner les données d'une autre entreprise. C'est la règle de sécurité n°1 du projet.

---

## 4. MODULES DU MVP (à développer maintenant)

### MODULE 1 — AUTHENTIFICATION & COMPTE
**Routes API :** `/api/auth/*`

- Inscription (email + mot de passe)
- Connexion (JWT)
- Mot de passe oublié (envoi email de reset)
- Page "Mon profil" (prénom, nom, email, téléphone, avatar)
- Vérification email à l'inscription (optionnel mais recommandé dès le départ)

### MODULE 2 — GESTION ENTREPRISES & LOCALISATIONS
**Routes API :** `/api/businesses/*`, `/api/locations/*`

- Créer / éditer / supprimer une entreprise
- Slug généré automatiquement (modifiable)
- Ajouter une ou plusieurs localisations ; **une entreprise a toujours au moins une localisation** (créée par le wizard d'onboarding)
- **La fiche Google (`google_place_id`) est portée par la LOCALISATION, pas par l'entreprise** (refonte 11b) : chaque localisation = une fiche GBP distincte avec ses propres avis. Le `google_place_id` est **obligatoire** sur chaque localisation.
- **Onboarding = wizard unifié** en une traversée : entreprise (saisie 100 % manuelle — nom, site, pays, fuseau) → 1ʳᵉ localisation (reliée à Google, obligatoire) → confirmation.
- Recherche autocomplétion via Google Places API **au niveau localisation** (pour lier sa fiche GBP)
- **Deux sélecteurs de contexte distincts** (voir 8.4) : entreprise active (tenant, topbar à droite) + localisation active (périmètre de travail, haut de sidebar)

### MODULE 3 — TABLEAU DE BORD PRINCIPAL
**URL :** `/tableau-de-bord`

- Message de bienvenue personnalisé
- Lien de collecte d'avis unique (copiable + QR code)
- Compteur de crédits restants
- KPIs simples (30 derniers jours) : avis collectés, note moyenne
- Liste des derniers avis reçus (aperçu)
- **Zone "Modules disponibles"** : cards visuelles pour activer/découvrir les futurs modules (même non développés, ça prépare le terrain visuellement et commercialement)

### MODULE 4 — PAGE DE COLLECTE D'AVIS (publique + son interface de réglages)
**URL publique :** `/avis/[slug-entreprise]/[slug-localisation]` (per-localisation depuis la refonte 11b : chaque fiche Google a sa page et son QR)
**Interface de réglages (admin) :** `/parametres-page-collecte`

**Modes de la page (sélecteur en haut des réglages) :**
- `smart` (défaut) : page intelligente — filtre étoiles, ≥ seuil → Google, < seuil → feedback privé
- `direct` : redirection immédiate vers Google, sans filtre
- `smart_vocal` (Phase 2) : même logique que `smart`, avec en plus un enregistrement audio + transcription IA. Affiché en UI comme "bientôt disponible".

Référence : capture de la page "Feedback Page" de ReputeUp fournie par toi. C'est une page de réglages riche, organisée en sous-sections dépliables. On reprend cette organisation, en distinguant ce qui est développé au MVP de ce qui vient enrichir le module en Phase 2 (vidéo, vocal, parrainage), conformément au principe d'extensibilité du projet (section 1.3).

**Sous-sections développées au MVP :**

```
🎨 Branding
├─ Logo : champ URL (MVP) — upload fichier à ajouter quand le stockage serveur sera en place (session stockage OVH, voir §12.4)
├─ Couleur CTA principale, couleur CTA secondaire
├─ Couleur de fond
└─ Masquer "Powered by [ta marque]" → réservé aux plans payants (comme ReputeUp
   réserve ça au plan supérieur), cohérent avec notre futur module Marque blanche

⭐ Rating Page (page de notation)
├─ Afficher le prénom du client (toggle)
├─ Étoiles de notation (1 à 5)
├─ Texte de description/accueil (éditable)
└─ Page d'atterrissage après notation (configurable : remerciement, redirection...)

✍️ Classic Review Collection (collecte texte classique)
├─ Titre de la section avis
├─ Témoignages suggérés/pré-remplis (questions d'amorce affichées en placeholder)
├─ Options activables : demander l'email, demander le poste/fonction, demander un
│  lien personnel/réseau social, demander une photo de profil, autoriser l'upload
│  d'image avec l'avis
└─ Couleur du bouton de soumission

🔗 External site (redirection externe)
├─ Activer/désactiver la redirection après avis positif
├─ Choix du site externe (Google en priorité)
└─ Lien direct vers la fiche (ex: lien d'avis Google précis)

🔍 SEO Metadata
├─ Titre SEO de la page
├─ Meta description
└─ Favicon personnalisé
```

**Logique note ≥ 4 / note < 4** (conservée du cahier des charges initial) :
- Si note ≥ 4 → proposition de redirection vers le site externe configuré (Google)
- Si note < 4 → formulaire de feedback privé affiché à la place (évite la publication d'avis négatifs publics, logique éprouvée chez ReputeUp via la "Review Choices")

**Sous-sections repoussées en Phase 2** (cohérent avec la logique modulaire — ce sont des extensions, pas le cœur du MVP) :

```
🎥 Video Form — collecte de témoignages vidéo (titre, description, champs de
   questions guidées) → nécessite stockage vidéo, traitement, lecteur intégré

🎙️ Voice Feedback + Voice Feedback Processing — collecte audio, prompts de
   questions, écran de traitement post-enregistrement → nécessite stockage audio
   + éventuelle transcription IA (lien possible avec le futur module "Avis vocaux"
   déjà identifié en section 9)

🔀 Review Choices — écran de choix entre Vocal / Vidéo / Écriture directe →
   n'a de sens qu'une fois Vidéo et Vocal développés ; au MVP, l'écriture directe
   est la seule option, donc pas d'écran de choix nécessaire

🎁 Referral Page — page de parrainage post-avis → fonctionnalité commerciale à
   part entière, à coupler avec un futur système de codes de parrainage
```

➡️ **Pourquoi cette répartition ?** Le MVP couvre déjà tout ce qui permet de collecter un avis texte de bout en bout, avec un branding correct et une bonne logique de redirection — l'essentiel pour tes premiers clients. Le reste (vidéo, vocal, parrainage) demande des briques techniques plus lourdes (stockage média, traitement) qui n'ont pas leur place avant que le cœur soit stable, mais l'interface est pensée pour accueillir ces sous-sections supplémentaires sans réorganisation (chaque sous-section est un bloc indépendant, comme chez ReputeUp).

- Responsive mobile (priorité, car scanné via QR code)
- Toutes les sous-sections de réglages suivent le même patron technique : un formulaire qui écrit dans le champ `config` (JSON) de l'entreprise ou dans une table dédiée selon le volume de données — voir section 6 (base de données)

### MODULE 5 — QR CODE
**Routes API :** `/api/qrcode/*`

- Génération automatique du QR Code pointant vers la page de collecte
- Téléchargement PNG/SVG
- Affichage avec logo entreprise (optionnel)

### MODULE 6 — INVITATION CLIENTS
**Routes API :** `/api/customers/*`, `/api/invitations/*`

- Ajout individuel d'un client (prénom, nom, email, téléphone)
- Import CSV (colonnes : prénom, nom, email, téléphone)
- **Case de consentement obligatoire au moment de l'import** : la personne qui importe (ton client) doit cocher une case du type *"Je confirme avoir obtenu le consentement de ces personnes pour être contactées par email/SMS/WhatsApp"* avant que l'import ne soit validé. Cette case est horodatée et stockée (qui a coché, quand) — pas juste affichée puis oubliée.
- Si la case n'est pas cochée → import bloqué, message explicatif
- Envoi d'invitation par email (SendGrid/Brevo)
- Envoi d'invitation par SMS (Twilio) — si crédits suffisants

#### Liste des clients
- Statut général du client : `Non invité` / `Invité` / `Avis déposé`
- Pour chaque client, affichage de **toutes les invitations reçues** : une icône par canal utilisé (✉ email, 📱 SMS) avec la date au survol. Si email + SMS envoyés → deux icônes distinctes côte à côte.
- Si un client a reçu plusieurs invitations sur le même canal, le nombre est affiché (ex : ✉×2)

#### Page Invitations — Envoi en masse avec cadence
La page `/invitations` est dédiée à la gestion des **campagnes d'invitation groupées** :

1. **Créer une campagne** : sélectionner N clients (multi-select avec filtres), choisir le canal (email/SMS), définir la cadence (X invitations/jour ou X invitations/semaine)
2. **Planification automatique** : le backend calcule les `scheduled_at` pour chaque invitation selon la cadence choisie et crée des enregistrements `status='pending'`
3. **Exécution** : un job `node-cron` tourne toutes les minutes, envoie les invitations `pending` dont `scheduled_at <= maintenant`, décrémente les crédits au fil de l'eau
4. **Suivi** : la liste des campagnes affiche la progression (X/N envoyées, % d'avancement, statut : en cours / terminée / en pause)

Table `invitation_campaigns` : `id`, `business_id`, `name`, `channel`, `rate_per_day` ou `rate_per_week`, `location_id`, `status` (running/paused/completed/cancelled), `created_at`
Champ `campaign_id` et `scheduled_at` ajoutés à la table `invitations`.

### MODULE 7 — SURVEILLANCE DES AVIS GOOGLE
**Routes API :** `/api/reviews/*`, `/api/google/*`

- Connexion OAuth Google Business Profile (chaque client autorise son propre compte — voir clarification ci-dessous)
- Récupération automatique des avis Google (cron quotidien)
- Liste des avis : auteur, note, texte, date, statut répondu/non répondu
- Filtre par note
- **Tags d'avis** : l'utilisateur classe ses avis avec des tags libres définis par entreprise (ex. « Coup de cœur », « Service », « Accueil »). Un avis peut porter plusieurs tags (relation N–N). Les tags servent ensuite à peupler sélectivement les widgets (voir Module 8). Tags 100 % manuels au MVP ; règles d'auto-tagging (ex. par note) repoussées en extension.
- Interface présentée comme une **liste de plateformes** (cards "Google Reviews", avec compteur total/nouveaux/note, bouton "Récupérer les avis"), à l'image de la capture ReputeUp que tu as fournie — mais au MVP, **seule la card Google est fonctionnelle**, les autres plateformes (Facebook, Tripadvisor, et d'autres — voir liste en 7.1) sont visuellement présentes mais désactivées/grisées avec un libellé "Bientôt disponible"

### 7.1 Important — l'OAuth Google ne couvre QUE Google, les autres plateformes viendront plus tard

Au MVP, **seule la plateforme Google est développée et active**. C'est un choix délibéré, pas une omission : Google est la seule avec une API d'avis publique, gratuite, bien documentée, et c'est de loin la plateforme la plus utilisée pour le local en France. Tout le reste (Facebook, Tripadvisor, et d'autres) est volontairement repoussé à plus tard.

Ta capture montre plusieurs plateformes côte à côte (Google, Tripadvisor, Facebook) avec des boutons "Activate" qui se ressemblent visuellement. C'est trompeur si on ne creuse pas : **ce ne sont pas des variantes du même mécanisme**. Chaque plateforme a sa propre logique d'accès, à traiter comme un mini-module indépendant le jour où on s'y attaquera — aucune ne sera "juste une case OAuth en plus à cocher" :

| Plateforme | Mécanisme d'accès réel | Complexité anticipée |
|---|---|---|
| **Google** *(seule développée au MVP)* | OAuth Google Business Profile (notre Module 7) | ✅ Standard, bien documenté, gratuit |
| **Facebook** | OAuth Facebook/Meta (Graph API) — nécessite une app Meta Business **validée par Meta** | 🟠 Démarche d'approbation à prévoir |
| **Tripadvisor** | Pas d'OAuth public pour récupérer les avis — API très restreinte, réservée à des partenariats. En pratique : scraping (zone grise CGU) ou agrégateur tiers payant | 🔴 Dépendance probable à un tiers |
| **Yelp** | API Fusion avec accès avis limité, clé API simple (pas d'OAuth par client) | 🟡 Plus simple côté technique, mais marché français limité |
| **Trustpilot** | API officielle avec OAuth, mais accès avis souvent réservé aux comptes Business payants côté client | 🟠 Dépend du plan Trustpilot du client final |
| **Booking.com / Airbnb** | Pas d'API publique pour récupérer les avis d'un établissement tiers | 🔴 Scraping ou non faisable proprement |
| **Pages Jaunes** | Pas d'API officielle connue | 🔴 À investiguer si la demande client se présente |

➡️ **Conséquence pour le MVP, sans ambiguïté :** seul Google est implémenté maintenant. Aucune démarche (création d'app Meta, étude de scraping, contact agrégateur) n'est à entreprendre pour les autres plateformes pendant le MVP ni pendant le développement du module concurrence — exactement le même principe que pour les modules GBP Posts/Photos (section 9). Le jour où une plateforme spécifique devient prioritaire (probablement Facebook en premier, car le plus demandé après Google), elle sera traitée comme un module à part entière avec sa propre étude d'accès.

➡️ **Ce qui est déjà prêt à les accueillir, sans rien changer :** la table `reviews` a dès le départ un champ `platform` (voir section 6) — ajouter une plateforme ne demande aucune migration de cette table, juste un nouveau connecteur (nouveau dossier `modules/`) et une nouvelle table de connexion dédiée (sur le modèle de `google_connections`, jamais une fusion a posteriori des mécanismes d'auth qui sont tous différents).

### MODULE 8 — WIDGETS BASIQUES
**Routes API :** `/api/widgets/*`, `/api/tags/*`

- Création d'un widget simple (carrousel d'avis OU badge de note — 1 ou 2 types pour le MVP)
- Personnalisation : thème clair/sombre, couleur de fond (transparent possible), police (ou celle du site), couleurs des étoiles/bordures/texte/accent — détail complet et catalogue dans `WIDGETS_DESIGN_FR.md`
- **Filtrage du contenu** : à la création d'un widget, on choisit ce qui le peuple — par **localisation** (optionnel) et/ou par **tag** (optionnel). Les deux filtres se cumulent. Exemple : « carrousel des avis de la *Boutique Lyon* tagués *Coup de cœur* ». Sans filtre, le widget affiche tous les avis de l'entreprise.
- **Builder** : formulaire organisé en sections repliables (Source des avis, Apparence, Contenu, Comportement) avec **aperçu en direct** (le vrai rendu embarqué, pas une imitation).
- Code d'intégration (snippet JavaScript à coller sur le site client)
- Le rendu embarqué est isolé (Shadow DOM, classes préfixées, aucun asset tiers) — voir `WIDGETS_DESIGN_FR.md`.

### MODULE 9 — SYSTÈME DE CRÉDITS & FACTURATION
**Routes API :** `/api/credits/*`, `/api/billing/*`

- Solde de crédits par entreprise
- Décrémentation automatique selon l'action (email = 2 crédits, SMS = 5 crédits, etc.)
- Intégration Stripe : abonnement mensuel + achat de packs de crédits
- Plan gratuit avec recharge mensuelle automatique (ex : 50 crédits/mois)
- Page "Facturation" : plan actuel, crédits restants, historique

### MODULE 10 — PARAMÈTRES
**Routes API :** `/api/settings/*`

- Paramètres généraux entreprise (nom, slug, email notifications)
- Gestion équipe (inviter membres, rôles)
- Sécurité (changement mot de passe)

---

## 5. CLARIFICATION : APIS GOOGLE (rappel important)

**Deux logiques différentes, à bien garder en tête pendant le développement :**

| API | Type de clé | Qui autorise | Coût |
|---|---|---|---|
| **Google Places API** (autocomplétion recherche d'entreprise + futur suivi concurrence) | Clé unique globale (la tienne) | Personne (transparent pour l'utilisateur) | À ta charge (~0,017$/requête) |
| **Google Business Profile API** (récupération des avis) | OAuth individuel | Chaque client autorise SON propre compte Google | Gratuit |

➡️ Aucun client ne te donne sa clé API. Il clique "Connecter Google", autorise via la fenêtre Google standard, et un token chiffré est stocké pour lui seul.

➡️ Pour le futur module de suivi des avis de la concurrence : pas besoin d'OAuth, les données (nombre d'avis, note moyenne d'une fiche concurrente) sont publiques et accessibles via la même clé Places API globale.

---

## 6. ARCHITECTURE BASE DE DONNÉES (pensée extensible)

```
users
├── id, email, password_hash, firstname, lastname
├── phone, avatar_url
└── created_at, updated_at

businesses
├── id, owner_id (FK users), name, slug
├── website_url, country, timezone
├── plan_id (FK plans)
├── feedback_page_config (JSON — branding, rating page, classic review,
│   external site, SEO metadata ; toutes les sous-sections du Module 4)
└── created_at, updated_at
-- Note : plus de google_place_id ici depuis la refonte 11b. La fiche Google
-- est portée par la localisation (1 entreprise = N fiches GBP, une par localisation).

locations
├── id, business_id (FK), name, slug (unique par entreprise — URL de collecte)
├── address (chiffré), lat, lng
├── google_place_id (OBLIGATOIRE — fiche GBP de la localisation), google_place_name
├── website_url (sert au favicon/logo)
└── created_at, updated_at

google_connections
├── id, business_id (FK), access_token (chiffré)
├── refresh_token (chiffré), scopes, expires_at
└── last_synced_at
-- Note : nommée spécifiquement pour Google au MVP. Le jour où Facebook sera
-- développé, on crée une table `facebook_connections` à part (mécanisme OAuth
-- différent, champs différents) plutôt que de généraliser celle-ci en `platform_connections` —
-- plus simple et plus sûr que de migrer une table déjà en production avec des
-- tokens chiffrés actifs.

reviews
├── id, business_id (FK), location_id (FK)
├── platform, external_id, author_name
├── rating, text, sentiment
├── published_at, replied, reply_text
└── created_at
-- Avis publics (Google), synchronisés en Phase 6.

private_feedbacks
├── id, business_id (FK), location_id (FK)
├── rating, comment, author_name, author_email
└── created_at
-- Retours privés (note ≤ 3) saisis sur la page de collecte publique. NON publiés :
-- visibles seulement par le propriétaire → on capte le mécontentement sans l'exposer.

customers
├── id, business_id (FK), firstname, lastname
├── email (chiffré), phone (chiffré), status
├── consent_given (boolean), consent_given_at, consent_given_by (FK users — qui a importé)
└── created_at

invitations
├── id, customer_id (FK), business_id (FK)
├── channel, sent_at, status
└── created_at

widgets
├── id, business_id (FK), name, type
├── config (JSON — flexible pour futurs types)
├── embed_code
└── created_at

credits
├── id, business_id (FK), amount, action_type
├── source (plan|purchase|bonus)
└── created_at

plans
├── id, name, monthly_credits, price
├── features (JSON — liste des modules inclus)
└── created_at

subscriptions
├── id, business_id (FK), stripe_subscription_id
├── plan_id (FK), status, renewal_date
└── created_at

team_members
├── id, business_id (FK), user_id (FK)
├── role, invited_at, accepted_at
└── created_at

-- Table pensée pour l'extensibilité --
business_modules
├── id, business_id (FK), module_key (ex: "rank_tracking", "seo_audit")
├── enabled (boolean), activated_at
└── settings (JSON — config propre à chaque module futur)
```

### Pourquoi la table `business_modules` est importante

Plutôt que de coder en dur "tel plan a accès à tel module", cette table permet :
- D'activer un module pour un client spécifique (même hors plan, ex: bêta-test chez un de tes clients perso)
- D'ajouter un nouveau module (ex: "Suivi positionnement GBP") sans migration lourde : juste une nouvelle clé `module_key`
- De stocker les réglages propres à chaque module dans son propre champ JSON, sans toucher au reste du schéma

### Pourquoi `feedback_page_config` est un seul champ JSON plutôt que plusieurs tables

La page de collecte (Module 4) a beaucoup de sous-sections de réglages (branding, rating page, classic review, SEO...), mais ce sont toutes des **données de configuration**, pas des données métier qu'on a besoin d'interroger/filtrer en base. Un seul champ JSON sur `businesses` suffit donc, et c'est même préférable :
- Ajouter une nouvelle option dans une sous-section (ex: un nouveau toggle dans "Classic Review Collection") = juste une nouvelle clé dans le JSON, aucune migration
- Quand les sous-sections Phase 2 (vidéo, vocal, parrainage) arriveront, elles s'ajoutent au même JSON sans toucher au schéma
- PostgreSQL gère très bien l'indexation et la recherche dans des champs JSON si jamais le besoin apparaît plus tard (c'est aussi une des raisons du choix de PostgreSQL plutôt que MariaDB, voir section 2.3)

---

## 7. STRUCTURE DE CODE (pensée extensible)

### 7.1 Backend — organisation par domaine, pas par type de fichier

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   └── auth.service.js
│   │   ├── businesses/
│   │   ├── reviews/
│   │   ├── widgets/
│   │   ├── credits/
│   │   ├── billing/
│   │   └── google-integration/
│   │       └── (futur emplacement naturel pour rank_tracking, search_console, etc.)
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── checkCredits.middleware.js
│   │   └── checkModule.middleware.js  ← vérifie qu'un module est activé pour ce business
│   ├── config/
│   │   ├── database.js
│   │   └── google.js
│   └── app.js
└── package.json
```

**Pourquoi ce découpage ?** Quand tu voudras ajouter "Suivi positionnement GBP" dans 6 mois, tu crées juste `modules/rank-tracking/` avec ses 3 fichiers, tu l'ajoutes à `business_modules`, et tu branches une route. Rien d'autre à toucher.

### 7.2 Frontend — organisation similaire

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard/
│   │   ├── Reviews/
│   │   ├── Widgets/
│   │   ├── Settings/
│   │   └── (futurs modules ajoutés ici, même logique)
│   ├── components/
│   │   ├── common/        ← boutons, inputs, cards réutilisables
│   │   └── layout/         ← sidebar, header (navigation pensée pour accueillir de nouveaux menus facilement)
│   ├── services/
│   │   └── api.js          ← un seul point d'appel Axios, facile à étendre
│   └── context/
│       └── AuthContext.js
```

---

## 8. CHARTE GRAPHIQUE DE L'ADMINISTRATION

### 8.0 Principe et inspiration

La référence visuelle est désormais une **capture réelle de l'interface d'administration Qwairy** (page "Competitor Mentions"), fournie par toi — pas le site vitrine marketing. C'est exactement le bon niveau de référence : un vrai dashboard d'admin, dense en données, sobre.

Détail intéressant : la page de référence est précisément le module de suivi de la concurrence, soit l'équivalent du futur module "Suivi des avis de la concurrence" que tu veux développer en priorité. Cette capture sert donc à la fois de référence de **style** (cette section 8) et de référence **fonctionnelle** pour ce module futur (à reprendre quand on le développera).

Esprit visuel à reproduire :
- Sidebar de navigation à gauche, organisée en **sections nommées** avec compteurs discrets
- Une seule couleur d'accent forte : le **violet** (boutons primaires, barres de progression, état actif)
- Fond général très clair (blanc cassé), cards et tableaux sur fond blanc
- Bordures fines plutôt qu'ombres lourdes — design **plat**
- Données présentées via badges-pilules, pastilles de score, mini-barres de progression
- Beaucoup de respiration malgré la densité d'information
- Typographie sans-serif, hiérarchie par la taille et le poids, pas par la couleur

➡️ **Ce document fixe les fondations dès maintenant** (palette, typographie, composants, layout) parce que les changer après coup demande de tout réécrire en CSS. Le détail fin (espacements exacts, micro-interactions) pourra s'ajuster visuellement au fil du développement, sans tout casser.

### 8.1 Palette de couleurs

Référence : capture réelle de l'interface Qwairy (page "Competitor Mentions") fournie par toi. Couleurs relevées et adaptées :

| Rôle | Couleur | Code | Usage |
|---|---|---|---|
| **Accent principal** | Violet | `#7C5CFC` | Boutons primaires ("View Plans"/"Upgrade"), barres de progression (mention rate, citation rate), sidebar item actif, bannières d'info teintées, accents de marque |
| **Succès** | Vert | `#1D9E75` | Badges de sentiment positif (pilule verte), statut "répondu", confirmation |
| **Danger** | Rouge | `#E24B4A` | Sentiment négatif, erreur, suppression |
| **Score / proximité** | Orange-coral | `#E8833B` | Pastilles circulaires de score (les badges "85"/"90" dans la capture), indicateurs chiffrés à mettre en avant |
| **Avertissement** | Ambre | `#BA7517` | Crédits faibles, action en attente, étoiles de notation |
| **Fond de page** | Blanc cassé | `#FCFCFD` | Arrière-plan général de l'admin (très clair, presque blanc) |
| **Fond carte / sidebar** | Blanc | `#FFFFFF` | Cards, sidebar, header, lignes de tableau |
| **Texte principal** | Quasi-noir | `#1A1A23` | Titres, noms, valeurs importantes |
| **Texte secondaire** | Gris | `#6B6B78` | Libellés de colonnes, texte de support, en-têtes de section sidebar |
| **Texte tertiaire** | Gris clair | `#9B9BA8` | Compteurs discrets (les "50", "100", "282" en sidebar), hints |
| **Bordure** | Gris très clair | `#ECECEF` | Séparateurs de lignes, contours de cards (fines, discrètes) |
| **Bannière info (fond)** | Violet pâle | `#F4F2FE` | Fond des encarts d'information teintés violet |

**Règle d'usage :** le violet est la seule couleur d'accent forte de l'interface (boutons primaires, barres, état actif). L'orange-coral est réservé aux **pastilles de score chiffré** (comme la proximité dans la capture) — un usage data-viz, pas décoratif. Les couleurs sémantiques (vert/rouge/ambre) ne servent qu'aux statuts et badges, jamais comme remplissage décoratif.

**Mode sombre :** la capture montre un bouton de bascule clair/sombre en haut à droite. Non prioritaire au MVP, mais toutes les couleurs doivent être déclarées en **variables CSS** dès le départ (jamais codées en dur dans un composant) pour pouvoir ajouter le thème sombre facilement plus tard.

### 8.2 Typographie

| Usage | Police | Taille | Poids |
|---|---|---|---|
| Titres de page (h1) | Inter | 24px | 600 |
| Titres de section (h2) | Inter | 18px | 600 |
| Sous-titres (h3) | Inter | 15px | 600 |
| Corps de texte | Inter | 14px | 400 |
| Texte secondaire / libellés | Inter | 13px | 400 |
| Chiffres clés (cards métriques) | Inter | 28px | 600 |
| Code / snippets (widgets embed) | Fira Code ou JetBrains Mono | 13px | 400 |

**Pourquoi Inter ?** Police gratuite (Google Fonts), très lisible en petite taille (important pour un dashboard dense en données), standard des interfaces SaaS modernes — c'est aussi la famille de police qu'on retrouve dans l'esprit Qwairy.

### 8.3 Composants de base (à standardiser dès le départ)

Référencés directement sur la capture Qwairy fournie.

```
Boutons
├─ Primaire   : fond violet plein (#7C5CFC), texte blanc, radius 8px ("View Plans", "Add Competitor")
├─ Secondaire : fond blanc, bordure fine grise, texte sombre, icône optionnelle ("Export", "Ask AI")
├─ Danger     : fond blanc, bordure rouge, texte rouge (ex: "Supprimer")
└─ Tous : hauteur ~34-38px, padding horizontal généreux, hover = léger assombrissement

Cards
├─ Fond blanc, bordure 1px gris très clair (#ECECEF), radius 12px
├─ Padding intérieur 14-20px
└─ Pas d'ombre lourde — bordure fine suffit (style Qwairy = plat, pas de relief)

Cards métriques (KPIs)
├─ Libellé discret en haut (gris, 13px)
├─ Chiffre en gros en dessous (26-28px, gras)
└─ Variation optionnelle (ex: "+4.2") en vert/rouge selon le sens

Badges de statut / pilules
├─ Forme pilule, fond pâle de la couleur sémantique, texte foncé de la même couleur
├─ Sentiment : pilule verte avec score (ex: "75.70" sur fond vert pâle, comme dans la capture)
├─ Position : pilule grise discrète (ex: "#3.40")
└─ Jamais de fond plein saturé (trop agressif sur un dashboard dense)

Pastilles de score circulaires
├─ Cercle à bordure orange-coral (#E8833B), chiffre centré (ex: "85", "90" = proximité)
└─ Pour tout score synthétique à mettre en avant visuellement

Barres de progression inline
├─ Petite barre violette sous un pourcentage (ex: mention rate "50.0%" + barre)
├─ Fond de barre gris très clair, remplissage violet
└─ Largeur proportionnelle à la valeur

Tableaux de données (avis, clients, concurrents)
├─ En-têtes de colonnes en gris, avec icônes de tri (flèches haut/bas) cliquables
├─ Lignes séparées par bordure fine, PAS de fond alterné (zébra) — plus propre
├─ Avatar/logo rond ou initiales à gauche de chaque ligne
├─ Petits tags contextuels possibles (ex: "14 pages" à côté d'un nom)
├─ Colonnes numériques alignées à droite
└─ Actions/détails accessibles par survol ou colonne dédiée à droite

Avatars / logos
├─ Cercle, soit logo de l'entité, soit initiales sur fond violet pâle
└─ Taille ~28-32px dans les listes
```

### 8.3bis Barre supérieure (topbar)

La capture montre une topbar riche en filtres, à reproduire dans l'esprit :
- À gauche : titre de la page, puis filtres déroulants (période 7j/30j/90j, filtre plateforme, filtre statut)
- **À droite : le sélecteur d'ENTREPRISE active (tenant)** — avatar + nom + chevron — avec la bascule clair/sombre et les actions contextuelles de la page ("Export", etc.)
- Fond blanc, séparée du contenu par une bordure fine

➡️ **Le sélecteur d'entreprise (tenant) est en haut à droite** car on change rarement de tenant. Le **sélecteur de localisation** — contexte de travail quotidien — est en **haut de la sidebar**, et le **compte utilisateur** en **bas de la sidebar** (voir 8.4 pour la convention des trois sélecteurs).

### 8.4 Structure de layout (sidebar + topbar)

La capture montre une sidebar organisée en **sections nommées** (Cockpit, Monitor, Analyze, Act, Optimize) avec des compteurs discrets à droite de chaque item. On reprend cette logique, adaptée à nos modules :

```
┌────────────────────────┬──────────────────────────────────────────┐
│ Locagain               │ Titre de page  [Filtres] [☀/🌙]  [Atlas ▼] │ ← TOPBAR
│                        │                  droite = ENTREPRISE (tenant)│
│ ┌────────────────────┐ ├──────────────────────────────────────────┤
│ │ 📍 Casablanca     ▼│ │                                          │
│ └────────────────────┘ │   ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  = LOCALISATION active │   │KPI │ │KPI │ │KPI │ │KPI │            │
│                        │   └────┘ └────┘ └────┘ └────┘            │
│ TABLEAU DE BORD        │                                          │
│  Vue d'ensemble        │   ┌────────────────────────────────┐     │
│  Localisations      2  │   │ Tableau de données             │     │
│ AVIS                   │   └────────────────────────────────┘     │
│  Surveillance      47  │                                          │
│  Répondre          12  │      (fond de page blanc cassé)          │
│ CLIENTS                │                                          │
│  Liste clients    156  │                                          │
│  Invitations           │                                          │
│ COLLECTE               │                                          │
│  QR Code               │                                          │
│  Widgets            3  │                                          │
│ MODULES                │                                          │
│  Concurrence   bientôt │  ← futurs modules en "bientôt"           │
│  Publications GBP      │                                          │
│  Photos GBP            │                                          │
│ ──────────────────     │                                          │
│ Crédits           287  │                                          │
│ [ Upgrade ] (violet)   │                                          │
│ ┌────────────────────┐ │                                          │
│ │ PB  Périé Bastien ▼│ │                                          │
│ └────────────────────┘ │                                          │
│  = COMPTE UTILISATEUR  │                                          │
└────────────────────────┴──────────────────────────────────────────┘
```

#### Hiérarchie des trois sélecteurs de contexte (convention figée)

L'interface manipule **trois niveaux de contexte distincts**, chacun avec son emplacement dédié — à ne jamais confondre :

| Emplacement | Sélecteur | Niveau (table) | Rôle |
|---|---|---|---|
| **Haut de la sidebar** | **Localisation active** | `location` | Fiche sur laquelle on travaille au quotidien : avis surveillés, invitations, QR/widgets générés. Sélecteur le plus utilisé → place la plus accessible. |
| **Haut à droite (topbar)** | **Entreprise active** | `business` (tenant) | Tenant courant : porte le plan, les crédits, le slug. Change rarement → à l'écart du flux de travail. |
| **Bas de la sidebar** | **Compte utilisateur** | `user` | Avatar + nom ; ouvre un sous-menu (profil, sécurité, déconnexion…) qui s'étoffera avec les actions de compte. |

**Pourquoi cet ordre :**
- La **localisation** est le périmètre réel des modules cœur (Surveillance, Répondre, Invitations, QR, Widgets sont tous *par fiche*) → place maîtresse en haut de sidebar.
- L'**entreprise** est un cran au-dessus dans la hiérarchie de données (1 entreprise = N localisations) mais on en change beaucoup moins souvent → topbar à droite.
- Le **compte utilisateur** est transverse aux deux → ancré en bas de sidebar, séparé des sélecteurs de données métier.

**Cas particuliers :**
- Sur les pages **niveau entreprise** (Vue d'ensemble agrégée, Paramètres, Facturation), le sélecteur de localisation est sans objet → grisé ou masqué.
- Une entreprise ayant **toujours ≥ 1 localisation** (invariante produit, Module 2), le sélecteur de localisation n'est jamais vide.

Caractéristiques reprises de la capture :
- En-têtes de section en petit gris (TABLEAU DE BORD, AVIS, CLIENTS...) au-dessus de groupes d'items
- Compteurs discrets alignés à droite de certains items (nombre d'avis, de clients, de localisations...)
- **Haut de sidebar : sélecteur de localisation active** (📍 + nom + chevron)
- Bloc crédits + bouton "Upgrade" violet en bas de sidebar
- **Bas de sidebar : compte utilisateur** (avatar initiales + nom) ouvrant un sous-menu d'actions de compte
- **Topbar à droite : sélecteur d'entreprise active** (tenant)
- Items en "bientôt disponible" pour les modules futurs (concurrence en premier)
- Sidebar fond blanc, ~240px, fixe

### 8.5 Langue

- Interface 100% française au MVP
- Tous les textes passent par un fichier de traduction centralisé (`fr.json`) dès le départ, même si une seule langue existe pour l'instant
- Ça évite de devoir tout réécrire quand tu ajouteras l'anglais ou autre plus tard

### 8.6 Implémentation technique recommandée

Pour que cette charte soit respectée partout sans copier-coller de styles :
- **TailwindCSS avec thème personnalisé** (`tailwind.config.js`) : les couleurs ci-dessus deviennent des classes (`bg-accent`, `text-danger`, etc.), pas des codes hexadécimaux répétés dans chaque fichier
- **Composants React réutilisables** dès le départ pour Bouton, Card, Badge, MetricCard — un seul endroit à modifier si tu changes d'avis sur un style
- Le site vitrine (futur, non prioritaire) pourra avoir sa propre identité plus proche de l'esprit marketing de Qwairy, complètement indépendante de cette charte d'administration

### 8.3 Langue

- Interface 100% française au MVP
- Tous les textes passent par un fichier de traduction centralisé (`fr.json`) dès le départ, même si une seule langue existe pour l'instant
- Ça évite de devoir tout réécrire quand tu ajouteras l'anglais ou autre plus tard

---

## 9. MODULES FUTURS ANTICIPÉS (non développés au MVP)

Cette liste sert de **feuille de route commerciale et technique**. Chaque module sera développé en respectant l'architecture en place (nouveau dossier `modules/`, nouvelle entrée `business_modules`).

### 🥇 Priorité 1 — premier module à développer après le MVP

| Module | Description | Dépendances |
|---|---|---|
| **Suivi des avis de la concurrence** | Voir le nombre d'avis postés par mois par les concurrents (entreprises similaires choisies par le client), avec courbes de comparaison pour savoir où on se situe et où on doit progresser par rapport à eux | Google Places API (récupération du nombre d'avis + note d'une fiche concurrente, données publiques, pas d'OAuth nécessaire) |

**Détail fonctionnel anticipé pour ce module :**
- Le client ajoute 1 à N fiches concurrentes (recherche par nom via Google Places, comme pour sa propre fiche)
- Relevé automatique quotidien ou hebdomadaire : nombre total d'avis, note moyenne, évolution
- Graphique comparatif : courbe "nombre d'avis cumulés" pour soi vs chaque concurrent sur une période donnée
- Indicateur simple : "vous générez X avis/mois, le concurrent Y en génère Z/mois" → objectif chiffré suggéré
- Table dédiée prévisible : `competitors` (business_id, google_place_id, name) + `competitor_review_snapshots` (competitor_id, review_count, average_rating, snapshot_date) — additive, ne touche à aucune table existante

### Autres modules anticipés (priorité à définir plus tard)

| Module | Description | Dépendances |
|---|---|---|
| **Suivi positionnement GBP** | Tracking quotidien du classement local (carte Google) sur mots-clés cibles | Google Business Profile API ou scraping géolocalisé |
| **Publications GBP (posts)** | Voir détail ci-dessous | Google Business Profile API (Local Posts) |
| **Photos GBP géolocalisées** | Voir détail ci-dessous | Google Business Profile API (Media), librairie EXIF |
| **Audit SEO automatique** | Scan technique d'un site client (vitesse, meta, structure) | Lighthouse API ou outil tiers |
| **Réponses IA aux avis** | Génération automatique de réponses aux avis via IA | Claude/OpenAI API |
| **Avis vocaux** | Collecte d'avis audio + transcription | Stockage serveur + API transcription |
| **Marque blanche** | Logo/couleurs/domaine personnalisés pour agences | Refonte légère du système de thème |
| **Rapports PDF automatiques** | Envoi mensuel d'un rapport par email | Génération PDF (Puppeteer) |
| **Intégrations CRM** | Connexion Zapier/Make.com | Webhooks sortants |
| **App mobile** | Consultation rapide des avis/notifications | API déjà prête (juste un nouveau client) |

### 9.1 Détail — Module "Publications GBP" (posts automatisés)

**Objectif :** publier automatiquement des posts (actualités, offres) sur la fiche Google Business Profile d'une entreprise, par lot et de manière échelonnée dans le temps.

**Fonctionnement anticipé :**
- Le client importe un **fichier CSV** contenant les futurs posts : colonnes attendues (texte du post, URL de l'image associée, éventuellement type de post / bouton d'action / lien)
- Chaque ligne du CSV = un post en attente de publication, stocké en base, pas publié immédiatement
- **Planification/échelonnement** (commun avec le module Photos, voir 9.3) : le client définit une date de début, un nombre de publications par semaine, et l'espacement souhaité → le système calcule automatiquement les dates de publication de chaque post de la file
- Un cron quotidien vérifie s'il y a des posts "dus" à cette date et les publie via l'API Google (Local Posts)
- Suivi du statut de chaque post : en attente / publié / échoué (avec raison de l'échec si l'API la fournit)
- ⚠️ **Point de vigilance technique à garder en tête pour PLUS TARD, pas maintenant** : l'accès à cette API Google n'est pas automatique — il faudra faire une demande d'accès officielle auprès de Google (justifier l'usage, avoir une fiche GBP vérifiée depuis plus de 60 jours, un site web) **le jour où ce module sera réellement mis en chantier**. Aucune démarche à entreprendre pendant le MVP ni pendant le développement du module concurrence — uniquement à anticiper quand ce module précis arrivera en haut de la pile.
- Table dédiée prévisible : `gbp_posts` (business_id, content_text, image_url, scheduled_date, status, published_at, error_message) — additive

### 9.2 Détail — Module "Photos GBP géolocalisées"

**Objectif :** publier des photos sur la fiche Google Business Profile, en leur assignant des coordonnées GPS précises (réécriture des métadonnées EXIF) avant publication, et avec le même système d'échelonnement que les posts.

**Fonctionnement anticipé :**
- Upload d'images (une à une ou en lot) depuis l'interface
- Pour chaque image : saisie ou sélection des **coordonnées GPS** à assigner (latitude/longitude) — utile par exemple pour des photos qui doivent apparaître comme prises à un endroit précis (devanture, intérieur, événement à une adresse spécifique)
- Réécriture des tags EXIF GPS de l'image côté serveur avant stockage/publication (bibliothèque de manipulation EXIF, ex: `exiftool` ou équivalent Node.js comme `exiftool-vendored` ou `piexifjs`)
- Mise en file d'attente avec le même système de planification que les posts (date de début, nombre par semaine, espacement)
- Publication automatique via l'API Google (Media) au moment planifié
- Table dédiée prévisible : `gbp_photos` (business_id, original_filename, storage_path, gps_lat, gps_lng, scheduled_date, status, published_at) — additive

**Point d'attention légal/éthique à garder en tête** (pas bloquant pour la conception, mais à noter) : assigner des coordonnées GPS à une photo pour qu'elle apparaisse comme prise à un endroit donné doit rester cohérent avec la réalité de l'activité du client (ex: photo d'un point de vente secondaire, d'un événement) — les règles d'utilisation de Google Business Profile interdisent les informations trompeuses sur un lieu. Pas un blocage technique, juste un garde-fou d'usage à avoir en tête côté produit.

### 9.3 Système de planification commun (posts + photos)

Plutôt que de coder la logique d'échelonnement séparément dans chaque module, elle est pensée comme un **service partagé**, réutilisable pour tout futur contenu à publier par lot sur GBP :

```
Paramètres de planification (par lot importé) :
├─ Date de début
├─ Nombre de publications par semaine (ex: 2/semaine)
├─ Espacement entre publications (ex: tous les 3 jours, ou jours fixes : lundi/jeudi)
└─ Calcul automatique de la date de chaque élément de la file à l'import

Exemple concret :
10 posts importés, début le 1er juillet, 2 par semaine
→ posts 1-2 : semaine du 1er juillet
→ posts 3-4 : semaine du 8 juillet
→ ... etc, jusqu'à épuisement de la file
```

Implémentation anticipée : un module `modules/gbp-scheduler/` indépendant, appelé à la fois par `gbp-posts` et `gbp-photos`, qui ne fait qu'une chose — distribuer une liste d'éléments sur des dates futures selon une règle de fréquence. Pas dupliqué dans les deux modules.

### 9.4 Emplacement dans le menu (sidebar)

Ces deux modules viennent enrichir la zone "MODULES" déjà prévue dans la sidebar (section 8.4), aux côtés du suivi de la concurrence :

```
MODULES
├─ Suivi de la concurrence     (priorité 1)
├─ Publications GBP             (priorité 2 — posts)
└─ Photos GBP                   (priorité 2 — photos géolocalisées)
```

Vu qu'ils partagent la logique de planification et la même finalité (alimenter une fiche GBP en contenu), ils pourront aussi être présentés comme deux onglets d'une même section "Contenu GBP" plutôt que deux liens séparés — décision purement visuelle à trancher au moment du design, sans impact sur l'architecture backend (qui reste modulaire dans tous les cas).

---

## 10. SYSTÈME DE CRÉDITS (MVP)

| Action | Coût en crédits |
|---|---|
| Email d'invitation | 2 |
| SMS d'invitation | 5 |
| Import CSV | 1 par ligne |
| Widget créé | 10 (one-time) |
| QR Code | Gratuit |

### Plans MVP

| Plan | Prix | Crédits/mois | Description |
|---|---|---|---|
| **Gratuit** | 0€ | 50 | Découvrez l'outil sans engagement |
| **Starter** | 29€/mois | 200 | Pour les indépendants et TPE |
| **Pro** | 50€/mois | 500 | Pour les PME multi-établissements |
| **Agence** | 90€/mois | 2000 | Pour les agences gérant plusieurs clients |

### Gestion des plans (Super Admin)

Les plans sont stockés en base de données (table `plans`) et **entièrement gérables depuis le panel Super Admin** sans redéploiement :
- Modifier le nom, la description, le prix, les crédits mensuels
- Modifier les `stripe_price_id` (mensuel/annuel) et `stripe_product_id`
- Modifier les fonctionnalités affichées (`features` JSONB — liste de strings)
- Activer / désactiver un plan (champ `active`)

Cela permet de changer les tarifs ou d'ajouter un plan sans toucher au code. Le panel Super Admin (session 32) contiendra une interface CRUD complète pour les plans.

---

## 11. PLAN DE DÉVELOPPEMENT MVP (10 semaines)

| Semaine | Contenu |
|---|---|
| **1** | Setup projet (React + Node.js + PostgreSQL), structure modulaire, repo Git, mise en place du chiffrement applicatif |
| **2-3** | Authentification + gestion entreprises/localisations |
| **4** | Dashboard + page de collecte publique + QR Code |
| **5** | Invitation clients (email + SMS) + import CSV |
| **6** | Connexion Google Business Profile + récupération avis |
| **7** | Système de crédits + intégration Stripe |
| **8** | Widgets basiques (1-2 types) |
| **9** | Paramètres, équipe, finitions UI |
| **10** | Tests, corrections, déploiement sur ton serveur |

---

## 12. SÉCURITÉ & CONFORMITÉ RGPD (point central du projet)

C'est un point que tu as raison de souligner fortement : la plateforme va manipuler des **données personnelles de tiers** (emails, téléphones, noms, parfois adresses) que tes clients importent eux-mêmes sur leurs propres clients finaux. Tu es donc à la fois "responsable de traitement" (pour les comptes utilisateurs) et "sous-traitant" (pour les listes de clients importées par tes clients). Ça impose un niveau d'exigence élevé dès le MVP, pas seulement plus tard.

### 12.1 Chiffrement des données personnelles (au repos)

Toutes les données personnelles identifiantes des **clients finaux** (table `customers` : email, téléphone) et certaines données sensibles des **locations** (adresse) sont **chiffrées avant d'être écrites en base**, pas seulement protégées par les permissions de l'application.

```
Principe technique :
├─ Algorithme : AES-256-GCM (chiffrement symétrique, authentifié)
├─ Clé de chiffrement : stockée dans une variable d'environnement (.env),
│  jamais en base, jamais dans le code
├─ Chaque champ chiffré stocke : valeur chiffrée + IV (vecteur d'initialisation) unique
├─ Déchiffrement à la volée uniquement au moment de l'affichage/utilisation
│  (jamais de déchiffrement en masse, jamais de cache en clair)
└─ Implémenté comme un middleware/helper Sequelize réutilisable
   (ex: hooks beforeSave/afterFind), pas du code dupliqué module par module
```

**Ce qui est chiffré dès le MVP :**
- `customers.email`, `customers.phone`
- `locations.address`
- `google_connections.access_token`, `google_connections.refresh_token` (déjà prévu, confirmé)

**Ce qui n'a pas besoin de l'être (mais reste protégé par les accès) :**
- `users.email` : nécessaire en clair pour la connexion/recherche, mais protégé par les permissions, le rate limiting sur l'auth, et jamais exposé publiquement
- Les noms/prénoms (moins sensibles isolément, mais jamais affichés sur une page publique sans consentement)

### 12.2 Chiffrement en transit

- **HTTPS obligatoire partout**, y compris en développement si possible (certificat Let's Encrypt sur ton serveur OVH, gratuit et automatisable)
- Aucune donnée (login, formulaire client, API) ne doit jamais transiter en HTTP simple
- En-têtes de sécurité HTTP (Helmet.js sur Express) : HSTS, CSP, X-Frame-Options, etc.

### 12.3 Droits RGPD à prévoir dès le MVP (pas après)

| Droit | Implémentation prévue |
|---|---|
| **Droit d'accès** | Le client final doit pouvoir demander quelles données sont stockées sur lui (process manuel acceptable au MVP, automatisable plus tard) |
| **Droit à l'effacement** | Bouton "Supprimer ce client" qui efface réellement la ligne (pas un simple flag `deleted=true`) et ses invitations associées |
| **Droit de rectification** | Édition possible des infos d'un `customer` depuis l'interface |
| **Consentement** | Case à cocher obligatoire au moment de l'import CSV (ou de l'ajout individuel) : ton client confirme avoir le consentement de ses propres clients pour être contactés. Stockée avec horodatage et identité de l'importateur (`consent_given`, `consent_given_at`, `consent_given_by`), pas un simple affichage non tracé. Import bloqué si la case n'est pas cochée. |
| **Minimisation des données** | On ne stocke que les champs réellement utiles (pas de champ "libre" qui finit par contenir des données non maîtrisées) |
| **Registre des traitements** | Document à part (pas dans le code) à tenir à jour avant ouverture publique |

### 12.4 Stockage local sur ton serveur OVH (remplace AWS S3)

Tous les médias (logos d'entreprises, futurs fichiers audio/vidéo) sont stockés **directement sur le serveur OVH**, pas sur un service tiers.

```
Organisation recommandée :
├─ Dossier de stockage HORS de la racine web publique
│  (ex: /var/www/saas-reputation/storage/, jamais dans /public/)
├─ Fichiers servis via une route Express dédiée avec contrôle d'accès
│  (jamais de lien direct fichier accessible sans vérification business_id)
├─ Nom de fichier randomisé (UUID), jamais le nom d'origine
│  (évite la devinette d'URL et les fuites d'info)
├─ Limite de taille et type de fichier strictement validée côté serveur
│  (pas seulement côté frontend)
└─ Sauvegardes régulières du dossier storage (rsync ou cron + compression),
   séparées des sauvegardes de la base de données
```

**Points d'attention spécifiques au stockage local (vs S3) :**
- Pas de réplication multi-zone automatique → la discipline de sauvegarde devient ta responsabilité (cron quotidien recommandé, avec rotation et copie vers un second emplacement, même un simple disque externe ou un autre serveur)
- Pas de CDN automatique → si les widgets deviennent très visités plus tard, prévoir un cache Nginx pour les fichiers statiques
- Espace disque à monitorer (alerte si le serveur approche la saturation)

### 12.5 Sécurité applicative générale

- Mots de passe hashés avec **bcrypt** (jamais stockés en clair, jamais même temporairement en log)
- Isolation stricte des données par `business_id` à **chaque requête**, vérifiée côté backend (jamais une confiance aveugle dans un ID envoyé par le frontend)
- Variables sensibles (clé de chiffrement, clés API, secrets JWT) uniquement dans `.env`, jamais en dur dans le code, `.env` exclu du dépôt Git
- Rate limiting sur les routes sensibles (login, inscription, page de collecte publique) pour éviter le bruteforce et le spam
- Validation stricte des entrées utilisateur côté backend (pas seulement côté frontend) pour éviter injections SQL et XSS — Sequelize protège déjà une bonne partie des injections SQL via les requêtes paramétrées
- Logs d'accès aux données sensibles (qui a consulté/exporté quoi, et quand) — utile à la fois pour la sécurité et pour répondre à une demande RGPD

### 12.6 Avant ouverture publique (pas bloquant pour usage avec tes clients perso)

- Politique de confidentialité + CGV/CGU rédigées et accessibles publiquement
- Registre des traitements RGPD tenu à jour
- Procédure documentée en cas de fuite de données (notification CNIL sous 72h si nécessaire)
- Désignation d'un contact RGPD (toi, à minima une adresse email dédiée)

---

## 13. PROCHAINES ÉTAPES

1. ✅ Valider ce cahier des charges
2. Installer PostgreSQL sur le serveur OVH (`ns3181892.ip-146-59-148.eu`), à côté de MariaDB (pas besoin de désinstaller MariaDB, les deux peuvent coexister)
3. Créer les comptes nécessaires : Google Cloud, Stripe (mode test), SendGrid/Brevo, Twilio
4. Générer et sécuriser la clé de chiffrement applicatif (`.env`, jamais versionnée)
5. Lancer Claude Code pour le setup initial (Semaine 1)
6. Développement progressif, validation à chaque module
7. Test avec 1-2 de tes clients perso avant ouverture plus large
8. Une fois le MVP stable : démarrer le développement du module "Suivi des avis de la concurrence" (priorité 1 des évolutions futures)

### Point en attente : nom et nom de domaine

Le nom du produit et son nom de domaine ne sont **pas encore définis** (à réfléchir). Ça ne bloque pas le démarrage du développement :
- En local et en phase de test, le projet peut tourner sous un nom de code provisoire (ex: dossier `saas-reputation`, sans impact sur le code)
- Le nom n'intervient concrètement que tardivement : config du sous-domaine, emails transactionnels ("expéditeur : nom@tondomaine.fr"), logo, métadonnées SEO de la page de collecte publique
- Aucune urgence à trancher avant la Semaine 1 — à statuer avant la Phase 4 (page de collecte publique) au plus tard, puisque c'est la première brique visible par un tiers (le client final qui laisse un avis)

---

**Ce cahier des charges te convient-il ? On peut ajuster avant de lancer Claude Code.**
