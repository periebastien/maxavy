# GEOGRID — Refonte « Positionnement » — Cahier des charges (wizard + suivi + concurrents)

> Cahier des charges de la **refonte UX + fonctionnelle** du module de suivi de positionnement (code : `rank-tracking` / geogrid).
> Socle technique (grille, provider DataForSEO, cron, scans/points, métriques) : **`GEOGRID_DESIGN_FR.md`** — toujours valable, réutilisé.
> Vue produit dans le cahier global : `CAHIER_CHARGES_MVP_EXTENSIBLE_FR.md` §9.5. Sessions : `PLAN_SESSIONS.md` Phase 11.
> Dernière mise à jour : 2026-07-02 (cadrage validé, décisions figées — développement G5 lancé).

---

## 0. Pourquoi cette refonte

Les sessions **G1→G4** ont livré un module fonctionnel : grille N×N, scan réel DataForSEO, cron autonome, heatmap Google Maps, métriques historisées, gating par plan. **Ce socle est conservé.**

Mais l'UX actuelle est minimale : une seule page, un mot-clé à la fois via un `<select>`, la configuration de grille cachée (paramètres backend jamais exposés), pas de planification fine, pas de courbes, pas de concurrents, pas de rapport client.

La refonte réorganise le module en **trois espaces** — **Configuration** (assistant en étapes), **Suivi** (résultats en lecture seule), **Concurrents** (comparaison) — ajoute une **planification précise**, des **courbes d'évolution**, le **suivi de concurrents**, et un **rapport email** au client final.

---

## 1. Concepts & vocabulaire

```
Entreprise (tenant)
└── Localisation (porte lat/lng + google_place_id)
    └── Configuration (1 par localisation) : grille + planning + concurrents + email
        ├── Mots-clés (N, dans la limite du plan)
        └── Concurrents (M, dans la limite du plan)

Rapport (« run ») = 1 exécution (planifiée ou manuelle)
    → scanne TOUS les mots-clés actifs de la localisation en une fois
    → produit N Scans (1 par mot-clé), tous datés du même rapport
        └── Scan = 1 grille de Points datée (heatmap + métriques d'un mot-clé)
            └── Point = 1 coordonnée GPS + rang de la fiche + résultats concurrents
```

- **Un rapport** est l'unité que voit l'utilisateur (« le rapport du 12 mars »). Techniquement c'est un `geogrid_run` qui regroupe N scans.
- **Un scan** reste l'unité technique par mot-clé (inchangé vs G1→G4).

---

## 2. Décisions actées (synthèse de la discussion)

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Structure config | **1 grille + 1 planning partagés par localisation**, mots-clés en dessous (fin du « config par mot-clé »). |
| 2 | Config par localisation | **1 seule** config par localisation au MVP (pas plusieurs grilles concurrentes). |
| 3 | Forme cercle | **Contour circonscrit** dessiné autour de la grille N×N complète — **même nombre de points qu'en carré** (révisé 2026-07-02 sur retour utilisateur ; le masque disque initial est abandonné). |
| 4 | Quota mots-clés | **Par localisation** (chaque localisation a son propre compteur). |
| 5 | Fuseau planification | **Par localisation, défaut = fuseau de l'entreprise, éditable manuellement.** Pas de dérivation auto (simplicité, aucune dépendance ajoutée). |
| 6 | Scan manuel | **Conservé** (« Lancer un rapport maintenant »), en plus du planning. |
| 7 | Métrique affichée | Chiffre unique **« Position moyenne (couverture) »** dans tableaux + courbes ; « visible » et « part de voix » en indicateurs secondaires. Sélecteur de métrique possible plus tard. |
| 8 | Agrégation temporelle | Sélecteur **« Moyenne de la période » / « Meilleure position »** (voir §4). |
| 9 | Graphes | **Recharts** sur le web ; email PDF (plus tard) = SVG généré côté serveur. |
| 10 | Quotas par plan | Le plan fixe le **plafond**, l'utilisateur choisit **dedans**. Plafonds **éditables en Super Admin** (session dédiée, §11). |
| 11 | Navigation | Section sidebar **« POSITIONNEMENT »** → **Configuration** + **Suivi** + **Concurrents**. |
| 12 | Rapport | Table **`geogrid_runs`** (1 ligne par exécution), pas de simple regroupement par jour. |
| — | Concurrents | Liste définie dans la config ; **agrégats par concurrent** (position moyenne + top 3/10/20) ; **coût data nul** (déjà récupérés). Stockage de ~20 résultats par point pour l'analyse rétroactive. |
| — | Alertes | **Hors périmètre** (aucune notification / alerte de chute de position). |
| — | Rapport email | **Configurable** (destinataires, cadence bornée par le plan), contenu = **meilleures positions de la période** + lien. |

---

## 3. Modèle de données

Conventions projet : `underscored: true`, pas d'associations Sequelize (jointures manuelles), `business_id` (+ `location_id`) sur chaque table, isolation via `assertAccess`. Données non personnelles → pas de chiffrement, **sauf `email_recipients`** (emails de clients finaux, donnée personnelle) chiffré AES-256-GCM via le helper projet, comme `customers.email` (voir §16).

### 3.1 Tables nouvelles

**`geogrid_configs`** — 1 par localisation (le cœur du wizard)
- `id` UUID PK · `business_id` FK · `location_id` FK **UNIQUE**
- `center_lat` / `center_lng` DECIMAL(10,7) *nullable* (null = centre sur la fiche)
- `shape` ENUM(`square`,`circle`) défaut `square`
- `grid_size` INT défaut 7 · `grid_spacing_m` INT défaut 500
- `frequency` ENUM(`monthly`,`weekly`,`daily`) défaut `weekly`
- `run_hour` INT (0–23) · `run_day_of_week` INT (0–6, *nullable*) · `run_day_of_month` INT (1–31, *nullable*)
- `timezone` STRING (défaut = `business.timezone`)
- `next_run_at` DATE *nullable* (calculé depuis le planning)
- `active` BOOL défaut true
- Bloc **rapport email** : `email_enabled` BOOL · `email_recipients` JSONB (`[]`) · `email_cadence` ENUM(`per_report`,`weekly`,`monthly`) · `email_day_of_week` / `email_day_of_month` / `email_hour`
- `created_at` / `updated_at`

**`geogrid_competitors`** — concurrents suivis (par config)
- `id` UUID PK · `business_id` FK · `config_id` FK
- `place_id` STRING (fiche Google du concurrent) · `name` STRING · `active` BOOL défaut true
- `created_at` · **UNIQUE** (`config_id`, `place_id`)

**`geogrid_runs`** — 1 par exécution
- `id` UUID PK · `business_id` FK · `location_id` FK · `config_id` FK
- `trigger` ENUM(`manual`,`scheduled`) · `status` ENUM(`pending`,`running`,`done`,`failed`)
- `scheduled_for` DATE *nullable* · `started_at` / `finished_at` DATE *nullable*
- `keywords_total` / `keywords_done` INT · `created_at`

**`geogrid_scan_competitors`** — agrégats d'un concurrent sur un scan
- `id` UUID PK · `scan_id` FK · `business_id` FK
- `place_id` STRING · `name` STRING
- `avg_position` DECIMAL(6,2) (position moyenne couverture, non-classé = 21)
- `points_top3` / `points_top10` / `points_top20` INT · `appearances` INT
- `created_at`

### 3.2 Tables modifiées

**`geogrid_keywords`** (allégé) : retirer `grid_size`, `grid_spacing_m`, `frequency`, `last_scanned_at` (la planification passe au niveau config). Ajouter `config_id` FK. Garder `keyword`, `active`, UNIQUE(`location_id`, `keyword`).

**`geogrid_scans`** : ajouter `run_id` FK (*nullable* pour l'historique existant) + `points_top3` / `points_top10` / `points_top20` INT. Le reste inchangé (`arp`, `atrp`, `solv`, snapshots `grid_size`/`grid_spacing_m`/`center`, `rating_snapshot`…).

**`geogrid_points`** : pas de changement de schéma. On stocke simplement **davantage de résultats** dans la colonne `competitors` JSONB (jusqu'à la profondeur récupérée, ~20 au lieu de 5) → permet d'agréger un concurrent ajouté **après coup**, et enrichit l'InfoWindow.

**`plans.module_quotas.rank_tracking`** (JSONB, éditable Super Admin) — structure enrichie :
```json
{
  "enabled": true,
  "max_keywords": 5,
  "max_grid_size": 7,
  "allowed_shapes": ["square", "circle"],
  "allowed_frequencies": ["monthly", "weekly"],
  "max_competitors": 3
}
```
> ⚠️ Le code actuel lit `plans.module_quotas.rank_tracking` (pas `plans.features` comme l'indiquait le cahier initial). On conserve `module_quotas`.
> ⚠️ **Renommage des clés** : le code lit aujourd'hui `grid_size` / `frequency` (singuliers). G5 migre vers `max_grid_size` / `allowed_frequencies` (array) / `allowed_shapes` / `max_competitors` et réécrit `normalizeGridSize` / `normalizeFrequency` en conséquence (voir §16).

### 3.3 Migration de données

Migration one-shot (données quasi-vides hors démo) :
1. Pour chaque localisation ayant des `geogrid_keywords`, créer 1 `geogrid_config` reprenant `grid_size`/`grid_spacing_m`/`frequency` (uniformes en pratique, sinon valeur par défaut du plan) + `center` = fiche + `timezone` = celle de l'entreprise.
2. Rattacher les mots-clés (`config_id`) puis retirer les colonnes migrées.
3. Les `geogrid_scans` existants restent avec `run_id` null (historique « legacy », toujours affichable).
4. Enrichir `plans.module_quotas.rank_tracking` (nouveaux champs) via migration + valeurs par défaut (§11).
5. **Housekeeping** : repasser la démo **Atlasimmobilier** `plan_id → null`.

---

## 4. Métriques & agrégations

### 4.1 Les chiffres (par scan, déjà calculés côté backend)

- **Position moyenne (couverture)** — rang moyen sur **tous** les points ; points où la fiche n'apparaît pas (hors Top 20) comptés **21**. *(= « ATRP » ; c'est LE chiffre des tableaux et courbes.)*
- **Position moyenne (visible)** — rang moyen sur les seuls points où la fiche apparaît. *(= « ARP », indicateur secondaire.)*
- **Part de voix** — % de points où la fiche est en Top 3. *(= « SoLV », indicateur secondaire.)*
- **Top 3 / Top 10 / Top 20** — nombre de points où le rang est ≤ 3 / ≤ 10 / ≤ 20. *(à ajouter sur le scan.)*

La même règle (non-classé = 21) s'applique à **ma fiche ET à chaque concurrent** → chiffres comparables et triables.

### 4.2 Agrégation temporelle (courbes + email)

Deux réglages indépendants :
- **Granularité (axe X)** : `jour` / `semaine` / `mois`.
- **Mode d'agrégation** : `Moyenne de la période` / `Meilleure position`.

Dans chaque intervalle (bucket), on agrège **les rapports qui y tombent** :
- Granularité `jour` : la valeur du/des rapport(s) du jour.
- Granularité `semaine` avec des rapports quotidiens : la **meilleure** (ou la **moyenne**) des positions de la semaine.
- Granularité `mois` avec des rapports hebdomadaires : la **meilleure** (ou la **moyenne**) des positions du mois.

> La **« Meilleure position »** est particulièrement utile pour le **rapport client** (montrer le meilleur de la période). Axe Y **inversé** (rang 1 en haut = mieux).

---

## 5. Navigation & pages

Nouvelle **section sidebar « POSITIONNEMENT »** (le modèle `sections` de `Sidebar.jsx` gère déjà titre + items, pas d'accordéon à créer) :

| Item | Route | Rôle |
|------|-------|------|
| **Configuration** | `/positionnement/configuration` | Assistant (wizard) + édition |
| **Suivi** | `/positionnement/suivi` | Résultats (lecture seule) |
| **Concurrents** | `/positionnement/concurrents` | Comparaison vs concurrents |

Verrou plan : si `rank_tracking.enabled = false`, la section est verrouillée (cadenas + CTA `/pricing`), comportement actuel conservé.

---

## 6. Configuration — l'assistant (wizard)

### Étape 1 · La grille
- **Carte** avec **centre déplaçable** (marqueur draggable) + bouton **« Recentrer sur la fiche »**. Stocké dans `config.center_lat/lng`.
- **Forme** : carré / cercle — **même nombre de points dans les deux cas** (décision produit, screenshots de référence 2026-07-02). En mode cercle, **les points remplissent le disque** (ce sont les N² points les plus proches du centre), ils forment donc un vrai cercle, pas un carré ; un contour `google.maps.Circle` est dessiné autour. **Dimension** (dans le plafond du plan). **Espacement** (m).
- **Compteur live** (à côté du bouton « Enregistrer et continuer », sous la carte) : « **X points · couverture ~Y km** ». Aperçu via `/grid-preview` (sans scan). *Le coût en $ n'est pas affiché à l'utilisateur* (interne) — à terme, exprimé en « points par rapport au pack » quand ce modèle sera défini.
- Nombre de points par grille (identique carré/cercle) : 3×3 → 9, 5×5 → 25, 7×7 → 49, 9×9 → 81, 11×11 → 121, 13×13 → 169, 15×15 → 225.

> Le **nombre de points** (= N²) pilote le coût (plafonné par plan) ; l'**espacement** ne change que la couverture (libre). En mode cercle, `buildGrid` renvoie les **N² points les plus proches du centre** (disque optimal — pour N impair ≤ 15 ça tombe pile sur des couronnes complètes, ex. 7×7 → disque de rayon 4 = 49 pts). Le contour et la couverture (diamètre) sont calculés côté front d'après le point le plus éloigné.

### Étape 2 · Les mots-clés
- Ajout / suppression, compteur « **X / N** » borné au plan (par localisation). Validation backend inchangée (403 si dépassé).

### Étape 3 · La planification
- **Fréquence** (selon plan) : mensuel / hebdo / quotidien.
- Puis : **heure** + **jour de la semaine** (hebdo) / **jour du mois** (mensuel ; 29–31 ramené au dernier jour du mois).
- **Fuseau** de la localisation (dérivé des coordonnées, défaut = fuseau entreprise).
- **Rapport email** (optionnel, configurable ici — voir §10) : destinataires + cadence.

### Étape 4 · Les concurrents (optionnelle)
- Ajout par **recherche de nom** → fiche Google (`place_id`), OU sélection depuis les **concurrents détectés** dans un rapport déjà réalisé.
- **Peut être faite après un premier rapport** : on lance d'abord un rapport sur les mots-clés, puis on choisit les concurrents parmi ceux réellement apparus (les ~20 résultats/point stockés permettent alors de calculer leurs agrégats, y compris rétroactivement).

### Récap & validation
- Résumé de la config + bouton **« Lancer un premier rapport maintenant »** (sinon la page Suivi reste vide jusqu'à la 1ʳᵉ exécution planifiée).

### Édition
- Réouverture du wizard **pré-rempli**. Changer la géométrie (taille/forme/espacement) est autorisé mais **marque une rupture de série** sur les courbes (repère visuel à la date du changement — comparaison avant/après indicative).

---

## 7. Planification (cron)

- On passe de « fenêtre écoulée » (`last_scanned_at` + 7 j / 1 j) à un **`next_run_at`** calculé depuis le planning de la config.
- Chaque tick (90 s, inchangé) : trouver les configs `active` dont `next_run_at ≤ now` → créer un **`geogrid_run`** → scanner tous les mots-clés actifs → recalculer `next_run_at` (fréquence + heure + jour + fuseau, clamp fin de mois).
- Le run passe `done` quand tous ses scans sont terminés ; à ce moment, déclenchement éventuel du **rapport email** (selon cadence).
- **Migration enum** : `frequency` `('weekly','daily')` → `('monthly','weekly','daily')`.
- Timeout / anti-chevauchement / bornage batch+concurrence : inchangés (`GEOGRID_*` dans `.env`).

### 7.1 Résilience (retry + étalement) — implémentée 2026-07-03

Constat : `next_run_at` était avancé **avant** le scan (anti-boucle) → un simple blip réseau (`fetch failed`, échec **transport**) faisait perdre une semaine entière, sans nouvelle tentative. Correctif : **découplage** de la cadence (`next_run_at`, jamais touchée par une reprise) et de l'**état de reprise** (colonnes séparées, tout en DB → survit au redémarrage).

- **Colonnes ajoutées** (migrations 50-52, additives) : `geogrid_scans.attempts / next_attempt_at / retry_reason`, `geogrid_runs.attempts / next_attempt_at / notify_failure`, statut `retry_pending` sur les deux enums.
- **Distinction transport vs métier** (provider) : seul un échec **transport** (`err.transient`) est retenté ; une erreur métier DataForSEO (champ invalide…) est définitive. Retry court (0,5-2 s) uniquement sur les **GET idempotents** (`tasks_ready`/`task_get`), **jamais** sur `task_post` (pas de clé d'idempotence → double facturation).
- **Level A — scan, échec transport (0 tâche postée)** : `retry_pending` + backoff **espacé** (`GEOGRID_RETRY_BACKOFF_SCAN` = 10/30/90 min) + **jitter déterministe** (`hashOffset(id)`, repris de la sync avis) → deux scans échoués au même instant ne repartent jamais en rafale. Re-soumission **en place** (`postScanTasks`, jamais de scan dupliqué), max `GEOGRID_MAX_SCAN_ATTEMPTS` (3).
- **Level B — partiel/timeout (tâches déjà payées)** : re-poll **direct** `task_get` par `provider_task_id` (pas via `tasks_ready`, plafonné/volatile), fenêtre `GEOGRID_RECOVERY_WINDOW_MINUTES` (6 h). **Coût 0 $** — on ne jette pas des données payées.
- **Level C — run entier inexploitable** : `closeFinishedRuns` replanifie (`retry_pending`, backoff `GEOGRID_RETRY_BACKOFF_RUN`) au lieu de clôturer, max `GEOGRID_MAX_RUN_ATTEMPTS` (2) ; relance en place les scans des mots-clés non couverts.
- **Anti-double-facturation** : `postScanTasks` ne re-POSTe **que** les points sans task et tente d'abord d'**adopter** une tâche déjà créée (crash-pendant-POST, best-effort via `tasks_ready`).
- **Étalement à grande échelle** (multi-tenant) : plafond `batchSize`/tick (déjà présent) + **plafond de points en vol** `GEOGRID_MAX_POINTS_IN_FLIGHT` (protège la file 1000 de DataForSEO) + **circuit-breaker** (`GEOGRID_BREAKER_THRESHOLD` échecs transport consécutifs → pause `GEOGRID_BREAKER_COOLDOWN_MINUTES` des **lancements ET reprises**). Ces portes ne bloquent que le lancement de travail neuf ; le poll et la clôture continuent.
- **Ordre `next_run_at`** : run créé **avant** l'avancement de `next_run_at` (crash avant création → relancé au tick suivant, pas de semaine perdue) ; avancement avec **saut des périodes ratées** (`computeNextRunAtSkipping`) → pas de rafale de rattrapage après une longue coupure.
- **`closeFinishedRuns`** : un scan `retry_pending` n'est **pas** terminal → le run reste ouvert (ni clôture ni alerte prématurée). `notify_failure` posé à la clôture définitive en échec = **hook** consommé par le rapport email (G11).
- **Reprises re-vérifiées** : `config.active` + quota du plan re-contrôlés avant chaque reprise (une fiche désactivée/downgradée ne consomme plus).

---

## 8. Suivi (lecture seule)

### 8.1 Vue globale (tous les mots-clés)
- **Sélecteur de rapport** (liste des dates où un rapport a tourné = les `geogrid_runs done`).
- **Tableau par mot-clé** : position moyenne (couverture) · top 3/10/20 · **évolution** vs rapport précédent (flèche).
- **Courbe multi-mots-clés** : 1 ligne par mot-clé, date de début réglable, select `jour/semaine/mois`, select `moyenne/meilleure`.
- Clic sur un mot-clé → vue détaillée.

### 8.2 Vue par mot-clé
- **Heatmap** du rapport sélectionné (composant `GeogridMap` réutilisé).
- **Cartes** : position moyenne (couverture / visible), part de voix, top 3/10/20.
- **Tableau triable** « ma fiche + concurrents » : position moyenne · top 3/10/20, tri par défaut sur le mieux positionné.
- **Courbe** du mot-clé (même réglages qu'en 8.1).
- **Aucune édition** ici (ni mots-clés, ni grille, ni planning).

---

## 9. Concurrents (page dédiée)

- Vue **comparaison** : comment ma fiche se situe face aux concurrents sélectionnés dans la config.
- Pour un **rapport** (date) et un **mot-clé** : le tableau triable « ma fiche + concurrents » (§8.2).
- **Courbes de comparaison** dans le temps : ma position moyenne vs celle de chaque concurrent (par mot-clé), mêmes réglages granularité/agrégation.
- Point d'entrée pour **ajouter/retirer** des concurrents (renvoie à l'étape 4 de la config) — dont la **sélection depuis les concurrents détectés**.

---

## 10. Rapport email

- **Configurable** dans la Configuration (étape 3) :
  - `email_enabled` · `email_recipients` (liste d'emails du **client final**).
  - `email_cadence` : `per_report` (à chaque rapport) / `weekly` / `monthly` — **jamais plus fréquent que la fréquence de scan**, options bornées par le plan. Ex. scans quotidiens → email possible quotidien / hebdo (jour au choix) / mensuel.
  - Pour une cadence réduite : `email_day_of_week` / `email_day_of_month` + `email_hour`.
- **Contenu** = **meilleures positions de la période couverte** (depuis le dernier email) : par mot-clé, meilleure position moyenne + top 3/10/20, et **lien** vers le Suivi complet.
- **Phasage** :
  - **v1** : email HTML (résumé chiffré + lien). Aucun rendu serveur de graphe.
  - **v2** (plus tard) : **PDF joint** avec la courbe — graphe généré en **SVG côté serveur** (pas de navigateur headless).

---

## 11. Quotas par plan & édition Super Admin

### 11.1 Plafonds par défaut (le plan borne, l'utilisateur choisit dedans)

| Plan | Mots-clés | Dimension max | Formes | Fréquences | Concurrents |
|------|-----------|---------------|--------|------------|-------------|
| Gratuit | — | — | — | — | — |
| Starter | 5 | 7×7 | carré + cercle | mensuel, hebdo | 3 |
| Pro | 15 | 9×9 | carré + cercle | mensuel, hebdo | 5 |
| Agence | 50 | 13×13 | carré + cercle | mensuel, hebdo, **quotidien** | 10 |

### 11.2 Édition via Super Admin *(à implémenter — session dédiée)*

Les plafonds ci-dessus **ne doivent pas être figés dans le code** : ils sont stockés dans `plans.module_quotas.rank_tracking` (JSONB) et **éditables depuis le panel Super Admin**, sans redéploiement — dans la continuité de la gestion des plans (cahier §10, session 32).

À prévoir pour cette édition (conçu maintenant, codé plus tard) :
- **Backend** : endpoint Super Admin `PATCH /admin/plans/:id/module-quotas` (ou extension de l'édition de plan existante) écrivant la clé `rank_tracking` ; validation des champs (`max_keywords`, `max_grid_size` impair, `allowed_shapes`, `allowed_frequencies`, `max_competitors`).
- **Frontend** : dans l'écran Super Admin des plans, un bloc « Suivi de positionnement » avec les champs éditables (nombre de mots-clés, dimension max, formes cochables, fréquences cochables, nombre de concurrents, activation du module).
- **Effet** : la modification s'applique aux prochaines lectures de quota (`getQuota`) ; les configs existantes qui dépasseraient un nouveau plafond sont **bornées à la lecture** (pas de scan au-delà) et signalées à l'utilisateur.
- Rappel : `business_modules` (`module_key = 'rank_tracking'`) reste le levier pour activer le module **hors plan** (bêta client), en surcouche.

---

## 12. Graphes (rappel technique)

- **Web** : **Recharts** (multi-lignes, tooltips, responsive, axe inversé). Seule dépendance front à ajouter.
- **Email PDF (v2)** : petit générateur **SVG côté serveur** (données maîtrisées) — évite Puppeteer.

---

## 13. Coûts (rappel)

- Coût **par point** (~0,0012 $ en queue Priority DataForSEO). **Quadratique** en dimension.
- **Cercle** ≈ −30 % de points à dimension égale → moins cher.
- **Concurrents** : **coût nul** (déjà dans les résultats récupérés).
- Multiplicateur fréquence : mensuel ×1 · hebdo ×~4,3 · quotidien ×~30. Le combo **grande grille × beaucoup de mots-clés × quotidien** est le coin coûteux → réservé au plan Agence (gating).

---

## 14. Chantiers → sessions (voir `PLAN_SESSIONS.md` Phase 11)

- **G5** — Refonte modèle & config partagée (migrations + migration de données + quotas enrichis).
- **G6** — Backend planning & grille cercle (forme disque, `next_run_at`, enum `monthly`, cron par runs, fuseau, `/grid-preview` étendu).
- **G7** — Backend concurrents & agrégats (liste, top 3/10/20 fiche + concurrents, endpoints runs/trend/config).
- **G8** — Frontend Configuration (section sidebar + wizard 4 étapes + édition + premier rapport).
- **G9** — Frontend Suivi (global + par mot-clé, tableaux triables, heatmap réutilisée, courbes Recharts).
- **G10** — Frontend Concurrents (comparaison + courbes concurrents).
- **G11** — Rapport email v1 (config + résumé + lien).
- **G12** — Super Admin : édition des quotas `rank_tracking`.
- *v2 ultérieure* : rapport PDF (SVG serveur).

---

## 15. Hors périmètre / différé

- Alertes / notifications de chute de position — **non**.
- Plusieurs grilles (configs) par localisation — différé (1 seule au MVP).
- Rapport PDF avec graphe — **v2**.
- Métrique de courbe commutable (visible / couverture / part de voix) — possible plus tard.
- Migration des marqueurs Google Maps `Marker` legacy → `AdvancedMarkerElement` (nécessiterait un `mapId`) — différé.

---

## 16. Précisions & points de vigilance (revue technique — 2026-07-02)

Issues d'une relecture croisée cahier ↔ code réel. À intégrer dans les sessions concernées.

**Migration & séquencement**
- **G5 et G6 indissociables** : retirer `frequency`/`grid_size`/`grid_spacing_m` de `geogrid_keywords` casse le cron actuel (`findDueKeywords` filtre `frequency` sur ce champ). La migration modèle (G5) et la bascule cron `next_run_at`/runs (G6) doivent être livrées **ensemble** (ou derrière un feature-flag).
- **Renommage des clés quota** : voir §3.2 (G5 réécrit `normalizeGridSize`/`normalizeFrequency`).
- `credits_used` reste **DECIMAL(10,4)** (déjà migré, migration 30) — ne pas régresser en INT.

**Grille cercle**
- **Cercle = disque des N² points les plus proches** (révisé 2 fois le 2026-07-02) : `buildGrid` en mode cercle renvoie les `N²` points de lattice les plus proches du centre → remplit un disque de façon optimale, **même nombre de points qu'en carré**, mais les points **forment un cercle** (v1 « contour autour d'un carré » rejetée par l'utilisateur : les points faisaient un carré ; v0 « masque disque » rejetée : 29 pts au lieu de 49). Tri déterministe (distance puis balayage). Le contour `google.maps.Circle` et la couverture (diamètre) sont dérivés côté front du point le plus éloigné.
- **Rang par quadrant** : quadrants équilibrés par construction (disque symétrique). Métrique secondaire.

**Concurrents**
- `MAX_COMPETITORS` passe de **5 à ~20** en G7 (profondeur DataForSEO `depth=20` déjà en place → **aucun surcoût**). **L'agrégation rétroactive ne vaut que pour les scans postérieurs** à ce changement (les scans G1→G4 n'ont que 5 résultats/point).
- Alimentation de `geogrid_scan_competitors` : (a) au **finalize** du scan pour les concurrents suivis à ce moment ; (b) à l'**ajout d'un concurrent** après coup → un **recompute** (`POST /competitors/recompute`) balaie `geogrid_points.competitors` des scans concernés.
- Imputation : la position moyenne d'un concurrent parcourt **tous les points du scan** et impute **21** là où son `place_id` est absent du JSONB. ⚠️ **21 = « hors profondeur mesurée », pas position réelle** : un concurrent réellement 35ᵉ est compté 21 → comparaison **bornée à la profondeur stockée** (à indiquer dans l'UI).

**Planification**
- `next_run_at` calculé **tz-aware** (fréquence + heure + jour + fuseau, clamp 29–31 → dernier jour du mois) → nécessite une **lib de dates tz-aware** (ex. **Luxon** ou `date-fns-tz`), dépendance à ajouter en G6.
- **Fuseau** : décision actée — défaut `business.timezone`, **éditable manuellement** sur la config. Pas de dérivation auto depuis les coordonnées (pas de dépendance `geo-tz`).
- **Statut d'un run partiel** : `done` quand tous les scans sont terminés ; `keywords_done` peut être < `keywords_total`. Ajouter un booléen `has_failures`. L'email part quand même, avec les mots-clés réussis (mention des échecs).

**Suivi & courbes**
- Clé d'agrégation des **courbes** = `(location_id, keyword_id)` **seul** : la géométrie (taille/forme) est une **annotation**, elle ne scinde pas la série (sinon un changement de grille couperait la courbe en deux).
- `points_top3/10/20` (scan et concurrents) : **figés au finalize** (comme arp/atrp/solv).

**Endpoints (indicatif, G6/G7)**
- Nouveau `POST /runs` = **rapport manuel complet** (tous les mots-clés actifs). L'ancien `POST /scans` (un mot-clé) devient **interne** (appelé par la création de run), plus déclenché depuis l'UI.
- Ajouts : `GET /runs`, `GET /runs/:id`, `GET /trend` (séries agrégées), `GET/PUT /config`, `GET/POST/DELETE /competitors`, `POST /competitors/recompute`.

**Quota par localisation**
- `assertQuotaAvailable` / `getQuotaStatus` comptent aujourd'hui **par business** ; G5/G8 ajoutent le filtre `location_id`. Décision actée : quota **par localisation** (chaque fiche a son propre compteur de mots-clés). Le plan **Starter reste à 1 seule localisation** (limite déjà existante ailleurs dans le SaaS), donc pas d'effet multiplicateur à ce niveau ; Pro/Agence autorisant plusieurs fiches, le volume total suit naturellement le nombre de localisations — **tous les plafonds restent éditables en Super Admin (G12)** si l'usage réel demande un ajustement.

**Conventions**
- `email_recipients` = emails de clients finaux (données personnelles) → **chiffrés AES-256-GCM** via le helper projet (comme `customers.email`), pas en clair (§3).
