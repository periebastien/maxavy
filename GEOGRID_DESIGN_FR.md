# GEOGRID — Suivi de positionnement Google Maps — Design & référence

> Document de référence du module « Suivi de positionnement local » (geogrid / heatmap de classement Google Maps).
> Sert à : cadrer le développement, revenir sur les décisions, faire évoluer la config.
> Dernière mise à jour : 2026-07-01 (cadrage initial, avant développement).
> Voir aussi : `CAHIER_CHARGES_MVP_EXTENSIBLE_FR.md` §9.5, `PROGRESS.md` (Phase 11), `WIDGETS_DESIGN_FR.md` (modèle de ce document).

---

## 1. Principe

Un rank-checker classique interroge Google depuis **un seul point** (l'adresse de la fiche) et rate l'essentiel : sur Google Maps, le classement change tous les quelques centaines de mètres. Une fiche peut être **#1 à son adresse et #12 à 2 km**.

Le **geogrid** corrige ça : on mesure le rang de la fiche **en de nombreux points GPS** autour d'elle, sur un ou plusieurs mots-clés, et on affiche le résultat en **heatmap** (une pastille colorée par point). Rejouer la même mesure dans le temps donne une **timeline** de l'évolution.

C'est exactement ce que vendent Local Falcon, BrightLocal (Local Search Grid), PlePer — et ce que montre la capture de référence.

---

## 2. Méthode (comment on le réalise)

Pour un scan (une fiche × un mot-clé × une date) :

1. **Centre** = coordonnées de la localisation (`locations.lat`, `locations.lng`, déjà en base). **Cible** = `locations.google_place_id`.
2. On génère une **grille carrée N×N** centrée sur ce point (N impair → un point tombe pile sur la fiche). Chaque point = une paire `(lat, lng)`.
3. **Pour chaque point**, une requête de recherche locale sur le mot-clé, **géolocalisée à ces coordonnées précises** (voir §4 — c'est le cœur technique).
4. On lit la liste de résultats (Top 20 sur Maps) et on cherche la position de `google_place_id` → c'est le **rang** du point. Absente du Top 20 → « non classée » (comptée 21 dans les moyennes).
5. On stocke rang + concurrents par point → un enregistrement `geogrid_scan` + N² `geogrid_point`.
6. On agrège les métriques (§5), on colore la heatmap (vert 1-3 / orange 4-10 / rouge 10+ ou absent).
7. Rejouer le même scan (même fiche + mot-clé + géométrie) à une autre date crée un point d'historique → **Trend report**.

### Géométrie de la grille
- Formes : 5×5 (25 pts), 7×7 (49), 9×9 (81), 11×11 (121), 13×13 (169). **Coût quadratique** en N → borner par plan.
- Espacement paramétrable (métrique : mètres/km ; défaut ~0,5 km entre points). Zone couverte = `(N-1) × espacement` dans chaque direction.
- Défaut MVP : **7×7, espacement 0,5 km** (couvre ~3 km de large — zone de chalandise urbaine typique).

---

## 3. Source de données — décision : **DataForSEO**

### Décision actée
| Option | Verdict |
|--------|---------|
| **Google Places API** (New) — déjà utilisée dans le projet | ❌ **Pas comme source de rang.** Ne renvoie pas le vrai classement « Local Finder » (tri API popularité/distance ≠ ranking Maps public) ; et sa ToS **interdit** de stocker/afficher un historique de classement dérivé de son contenu (seuls `place_id` indéfiniment et `lat/lng` 30 j sont cachables). ✅ On la garde uniquement pour géocoder/afficher des fiches. |
| **Scraping maison** de Google | ❌ Fragile (markup + CAPTCHA), viole les CGU Google, exige proxys résidentiels + maintenance permanente → dette technique et risque juridique **portés par nous**. À éviter pour un produit vendu. |
| **DataForSEO** — Google Maps SERP API | ✅ **Retenu.** Le fournisseur porte le risque proxy/CGU et la maintenance anti-blocage. Le vrai rang Local Finder, paramètre `location_coordinate = "lat,lng,zoom"`, 1 point = 1 task. Très bon marché (~0,0012 $/task en queue **Priority**, voir décision ci-dessous). |

**Abstraction fournisseur** (obligatoire) : le backend n'appelle jamais DataForSEO en direct depuis le service métier. On passe par une interface `RankProvider` (`fetchLocalRank({ keyword, lat, lng, zoom, targetPlaceId }) → { rank, competitors[], rating, reviewCount }`) avec une implémentation `dataforseo.provider.js`. Basculer vers SerpApi/Oxylabs plus tard = une nouvelle implémentation, zéro refonte du module.

### La question des proxys (réponse claire)
**Non, on ne gère aucun proxy.** DataForSEO gère déjà le pool de proxys, la rotation et les CAPTCHA. On envoie des coordonnées, on reçoit le rang.

Point clé à comprendre : **le proxy n'est pas le sujet du geogrid.** Un proxy donne une IP à l'échelle d'une ville au mieux — jamais une IP « au coin de la rue » pour 49 points espacés de 500 m. La géolocalisation **fine** (celle qui fait bouger le rang d'un point à l'autre) se transmet par le **paramètre de coordonnée** (`location_coordinate` chez DataForSEO, `ll=@lat,lng,zoom` ailleurs), **pas par l'IP**. Donc : proxy = problème d'accès (anti-blocage, géré par le provider) ; coordonnée = problème de mesure (le vrai geogrid, géré par nous via la grille).

### Modèle asynchrone DataForSEO (à prévoir dans le code)
DataForSEO fonctionne en tâches : `task_post` (jusqu'à 100 tasks/appel) → attente → `tasks_ready` / `task_get`, ou **pingback/webhook**. Un scan geogrid = N² tasks. Le service :
1. crée le `geogrid_scan` (statut `pending`), génère les N² points ;
2. poste les tasks (une par point) ;
3. un job de **poll** (ou un endpoint webhook DataForSEO) récupère les résultats à mesure, remplit `geogrid_points`, passe le scan à `done` et calcule les métriques.
- **Queue Priority retenue** (2026-07-01, décision produit) : ~1 min de délai moyen, ~0,0012 $/task (2× le prix de la queue Standard ~0,0006 $/~5 min, mais toujours anecdotique à l'échelle du produit — voir §9). Choisie pour fiabiliser le cron de poll (G3) : résultats prêts vite et de façon prévisible, ce qui limite le temps où des tâches s'accumulent dans `tasks_ready` (plafonné à **1000 résultats non récupérés** chez DataForSEO, vérifié en réel) et permet un poll plus rapproché. Configurée via la constante `TASK_PRIORITY = 2` dans `dataforseo.provider.js` (champ `priority` du payload `task_post`). **Live** (~1 task/appel, synchrone) reste hors-jeu pour un scan grille — testé en réel : rejette tout appel à plusieurs tâches (`"You can set only one task at a time"`) ; utile seulement pour un futur « check rapide 1 point », pas pour le geogrid complet.

---

## 4. Métriques

Calculées par scan (nomenclature Local Falcon, standard du marché) :

| Métrique | Définition |
|----------|------------|
| **ARP** (Average Rank Position) | Rang moyen **sur les seuls points où la fiche apparaît** (Top 20). « Là où je suis déjà visible ». Plus bas = mieux. |
| **ATRP** (Average Total Rank Position) | Rang moyen **sur tous les points**, non classés comptés = 21. Vue réaliste de la couverture. `ATRP >> ARP` = fort au centre, décroche en périphérie. |
| **SoLV** (Share of Local Voice) | % des points où la fiche est dans le **Top 3** (le Local Pack). Meilleur indicateur de domination. Score /100. |
| **Rang par quadrant** | Rang moyen ventilé NW / NE / SW / SE (+ centre) → repère la direction géographique où la visibilité chute. |
| **Snapshot avis** | Note étoiles + nombre d'avis de la fiche au moment du scan (stockés pour corréler avis et rang dans le temps). |
| **Par point** | Rang exact + liste ordonnée des concurrents présents à ce point. |

---

## 5. Modèle de données

Conventions projet respectées : **pas d'associations Sequelize** (jointures manuelles `where` + `Op.in`), `underscored: true`, chaque table porte `business_id` (+ `location_id`) et filtre dessus via `assertAccess`. Données non personnelles → **pas de chiffrement** (le geogrid ne stocke ni email, ni adresse client).

```
geogrid_keywords            -- les mots-clés suivis, par localisation
├── id (UUID), business_id (FK), location_id (FK)
├── keyword (string), active (bool)
├── grid_size (int, défaut 7), grid_spacing_m (int, défaut 500)
├── frequency (enum: weekly|daily, défaut weekly)
└── created_at
-- unique (location_id, keyword)

geogrid_scans               -- un passage à une date (= un point d'historique)
├── id (UUID), business_id (FK), location_id (FK), keyword_id (FK)
├── keyword (string, snapshot), grid_size, grid_spacing_m
├── center_lat, center_lng
├── status (enum: pending|running|done|failed), provider (string)
├── arp, atrp, solv (decimal)             -- métriques agrégées
├── rating_snapshot, review_count_snapshot
├── points_total, points_ranked (int)
├── credits_used (int, nullable)          -- pour info coût, même si facturation par plan
├── scanned_at, created_at
-- série temporelle = (location_id, keyword_id, grid_size, grid_spacing_m)

geogrid_points              -- une ligne PAR point du scan
├── id (UUID), scan_id (FK), business_id (FK)   -- business_id dupliqué pour l'isolation directe
├── row, col (int), quadrant (enum: NW|NE|SW|SE|C)
├── lat, lng
├── rank (int, nullable = non classé)
├── competitors (JSONB: [{ place_id, name, rank, rating, reviews }])  -- top concurrents à ce point
└── created_at
```

> Les concurrents sont stockés en JSONB dans `geogrid_points` au MVP (pas de table `geogrid_competitors` normalisée) — suffisant pour l'affichage « qui domine ce point ». Normalisation possible plus tard si on veut agréger la concurrence à l'échelle grille.
>
> **Conformité** : on stocke **notre métrique** (un entier de rang + la liste ordonnée à un instant t), pas des copies massives de contenu Google. C'est le dérivé analytique que revend tout le marché du geogrid.

---

## 6. Backend

- Module : **`backend/src/modules/rank-tracking/`** (aligné cahier §7.1 qui cite déjà cet exemple) → `rank-tracking.routes.js` + `.controller.js` + `.service.js`, monté sur `/api/v1/rank-tracking` dans `app.js`.
- Providers : `rank-tracking/providers/dataforseo.provider.js` (+ `index.js` qui sélectionne le provider par env `RANK_PROVIDER`). Clé API dans `.env` (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`), jamais en dur.
- Géométrie : helper `buildGrid(centerLat, centerLng, n, spacingM)` → liste de `{ row, col, quadrant, lat, lng }` (conversion mètres→degrés en tenant compte de la latitude pour la longitude).
- Isolation : `assertAccess(business, userId)` sur **chaque** opération (comme tags/reviews). `business_id` en query param.
- Cron (**G3, implémenté**) : **`backend/src/jobs/scan-geogrid.js`** exportant `startScanGeogridJob()`, appelé dans `app.js` après `sequelize.authenticate()`. **Boucle unique `setInterval` toutes les `GEOGRID_TICK_SECONDS` (défaut 90 s)** — pas node-cron, car 90 s n'est pas exprimable en cron (champ secondes ≤ 59). Chaque tick, dans l'ordre : (1) `failStuckScans` (scans `pending/running` plus vieux que `GEOGRID_SCAN_TIMEOUT_MINUTES` → `failed`), (2) `refreshRunningScans` (un seul `tasks_ready` partagé pour tout le tick, puis `task_get` par point prêt), (3) `runDueScans` (mots-clés dus → lancement). **Garde anti-chevauchement** (un tick qui déborde fait sauter le suivant). Paramètres dans `.env` (voir ci-dessous).
  - **Détection « dû »** : colonne `geogrid_keywords.last_scanned_at`, posée au lancement d'un scan (auto ou manuel). Un mot-clé est dû si `last_scanned_at` est NULL (jamais scanné, prioritaire) ou plus vieux que sa fenêtre (`weekly` = 7 j / `daily` = 1 j). Posée **avant** la soumission → un échec ne relance pas en boucle (retry à la fenêtre suivante ; le scan manuel reste l'échappatoire immédiate).
  - **Scalabilité** (bcp de fiches) : lot borné `GEOGRID_BATCH_SIZE` (défaut 20) mots-clés/tick + lancement parallèle plafonné `GEOGRID_CONCURRENCY` (défaut 20) → étale la charge au lieu d'une salve. Pool PostgreSQL relevé 5 → 20 (`DB_POOL_MAX`) pour absorber le parallélisme. Un mot-clé dont l'entreprise a perdu le module au plan (downgrade) est ignoré sans être relancé.
- Endpoints (`/api/v1/rank-tracking`, **G1/G2 implémentés**) :
  - `GET/POST/PATCH/DELETE /keywords` (CRUD mots-clés, borné par le quota du plan — §7).
  - `GET /quota`, `GET /grid-preview` (aperçu de la grille avant scan).
  - `POST /scans` (scan à la demande), `GET /scans`, `GET /scans/:id` (heatmap : points + concurrents), `POST /scans/:id/refresh` (poll manuel — même cœur que le cron).
  - *À venir G5* : `GET /trend?keyword_id=` (série ARP/ATRP/SoLV dans le temps).

### Paramètres du cron (`.env`, réglables — voir `rank-tracking.config.js`)
```
GEOGRID_TICK_SECONDS=90          # fréquence de la boucle
GEOGRID_BATCH_SIZE=20            # mots-clés dus traités par tick (max)
GEOGRID_CONCURRENCY=20           # scans lancés/rafraîchis en parallèle (max)
GEOGRID_SCAN_TIMEOUT_MINUTES=15  # au-delà, un scan non terminé → failed
DB_POOL_MAX=20                   # pool PostgreSQL (relevé pour le parallélisme)
```

---

## 7. Facturation & gating par plan (décision actée)

**Pas de crédits par scan.** Le module est **inclus selon le plan**, avec des quotas. Gating via `plans.features` (JSONB, éditable en Super Admin — cahier §10), clé `rank_tracking`. Toujours **borné par le nombre de localisations** du plan.

| Plan | Geogrid | Mots-clés max | Grille max | Fréquence |
|------|---------|---------------|-----------|-----------|
| **Gratuit** | ❌ absent (module masqué/verrouillé) | — | — | — |
| **Starter** (29€) | ✅ inclus, **bridé** | **5** | 7×7 | hebdo |
| **Pro** (50€) | ✅ inclus | *à ajuster* (~15) | *à ajuster* (~9×9) | hebdo (option quotidien ?) |
| **Agence** (90€) | ✅ inclus | *à ajuster* (~50) | *à ajuster* (~13×13) | *à ajuster* |

- **Décision figée** : Free exclu ; Starter = 5 mots-clés. Pro/Agence = valeurs indicatives **à ajuster plus tard** (marge vs coût data).
- Le module vérifie le quota à la création d'un mot-clé (403 si dépassé) et masque/verrouille l'entrée sidebar si le plan n'inclut pas `rank_tracking`.
- `business_modules` (`module_key = 'rank_tracking'`) reste disponible pour **activer le module hors plan** (bêta chez un client précis), en surcouche du gating par plan.

---

## 8. Frontend

- Page : **`frontend/src/pages/GeogridPage.jsx`** (probablement en `React.lazy` — la carte est lourde), route `/positionnement` dans `App.jsx` (`PrivateRoute` + `RequireBusiness`).
- Périmètre = **localisation active** (`useLocations().activeLocation`), comme avis/QR/widgets. Business_id en query param sur chaque appel.
- Sélecteur de **mot-clé** en haut de page (chaque mot-clé = sa heatmap + sa timeline).
- **Carte / heatmap** : réutiliser le loader Google Maps déjà intégré (`@googlemaps/js-api-loader` v2.x, `importLibrary('maps'|'marker')` — ⚠️ la classe `Loader` n'existe plus). Pastilles = marqueurs colorés numérotés (rang) posés aux `(lat, lng)` des points ; clic sur un point → panneau « concurrents ici ». Cohérent avec la capture de référence (fond Google Maps). Alternative plus légère/gratuite si le coût « map loads » devient un souci : Leaflet + tuiles OSM.
- Bandeau métriques : ARP / ATRP / SoLV + note & nombre d'avis (composant `MetricCard` existant).
- Timeline : courbes ARP/ATRP/SoLV par date (lib de chart à ajouter — aucune présente).
- Sidebar : entrée section **MODULES** `{ label: 'Positionnement', to: '/positionnement', icon: <Map/>, soon: true }` — `soon:true` tant que non livré, verrou visuel si plan sans `rank_tracking`.
- ⚠️ **Aucune lib de carte ni de chart n'est installée** → 2 dépendances à ajouter au moment du dev.

---

## 9. Coût (ordre de grandeur, données réelles DataForSEO — queue Priority retenue)

Formule : `requêtes = points × mots-clés × fréquence × nb entreprises`.
Exemple **7×7 (49 pts) × 3 mots-clés × 1 scan/semaine** par entreprise ≈ **636 requêtes/mois**.

| Échelle | DataForSEO Priority (0,0012 $/req, vérifié en réel) |
|---------|-------------------------------------|
| 1 entreprise | ~**0,76 $/mois** |
| 100 entreprises | ~**76 $/mois** |
| 1 000 entreprises | ~**763 $/mois** |

2× le coût de la queue Standard (0,0006 $/req, ~5 min de délai) — écart jugé anecdotique à l'échelle du produit et compensé par un cron de poll (G3) plus simple et plus fiable (délai moyen ~1 min au lieu de ~5, confirmé par test réel : scan 3×3 complet en 2 s de bout en bout).

Leviers de coût : **taille de grille** (quadratique — 5×5=25 vs 9×9=81), nombre de mots-clés, fréquence (hebdo vs quotidien ×7). D'où le gating par plan (§7).

---

## 10. Découpage en sessions (proposition)

Périmètre **complet** retenu (grille + heatmap + multi mots-clés + historique). Suggestion de séquençage :

1. **Backend geogrid — schéma & grille** : migrations (`geogrid_keywords`, `geogrid_scans`, `geogrid_points`), modèles, `buildGrid()`, CRUD mots-clés + gating quota.
2. **Backend geogrid — provider & scan** : `RankProvider` + `dataforseo.provider`, `POST /scan`, calcul des métriques (ARP/ATRP/SoLV), stockage points + concurrents.
3. **Backend geogrid — cron & poll** : `scan-geogrid.js` (hebdo), récupération asynchrone des tasks, série temporelle.
4. **Frontend geogrid — heatmap** : `GeogridPage`, carte Google + pastilles, sélecteur mot-clé, bandeau métriques, panneau concurrents par point.
5. **Frontend geogrid — timeline & polish** : courbes ARP/ATRP/SoLV, scan à la demande (Live), états vides/loaders, verrou par plan.
