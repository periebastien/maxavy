# AVIS_CONCURRENTS_FR — Suivi des avis de la concurrence

> Cahier des charges dédié du module (cadré 2026-07-03, sessions **AC1→AC3** — `PLAN_SESSIONS.md` Phase 12).
> Prérequis livré : synchro des avis via DataForSEO (session 21, voir `PROGRESS.md` Phase 6).

## 1. Objectif produit

Pour une **localisation** donnée : comparer le **nombre d'avis reçus par mois** entre ma fiche et mes concurrents, avec l'historique par année. Le but : vérifier que je collecte **plus d'avis chaque mois** qu'eux — et voir la tendance quand ce n'est pas le cas.

Nouvel onglet sidebar : section **AVIS → « Concurrents »** (route `/reviews/concurrents`).

## 2. Décisions actées (2026-07-03)

1. **Source = DataForSEO** `business_data/google/reviews` — et non Places API comme envisagé au cahier §9 : Places ne renvoie que le total du moment (pas de timestamps), il faudrait des mois de snapshots pour construire un historique. Le backfill DataForSEO donne le rythme mensuel **immédiatement**.
2. **Liste de concurrents partagée** avec le positionnement (`geogrid_competitors`) *pour l'instant* (décision utilisateur). **Découplage prévu** : les données d'avis sont keyées par `place_id` — **aucune FK vers `geogrid_competitors`** — pour qu'un passage à une liste dédiée plus tard ne change qu'une fonction (`getTrackedCompetitors()`) et l'UI de gestion.
3. **Quota** = `rank_tracking.max_competitors` existant (Starter 3 / Pro 5 / Agence 10) — aucune nouvelle clé. Éditable Super Admin (périmètre session G12, déjà prévu). Conséquence assumée du partage : pas de module positionnement au plan ⇒ pas de liste ⇒ pas de suivi d'avis concurrents (tous les plans payants ont les deux aujourd'hui).
4. **Cadence quotidienne fixe** pour tous les plans (`REVIEWS_COMPETITOR_INTERVAL_MINUTES`, défaut 1440) — indépendante de la cadence « ma fiche » (`reviews.interval_minutes`). Échelonnement déterministe (hash → offset sur l'intervalle, mécanique session 21) : jamais d'appels en rafale.
5. **Backfill** (depth 200) en file **priority** (~1 min, résultat visible pendant que l'utilisateur est sur la page) ; **quotidien** (depth 10, `sort_by=newest`) en **standard**. Garde anti-saturation identique à la session 21 (incrémental plein → re-backfill).
6. **Règle de complétude** : le backfill ramène les 200 *derniers* avis → les mois ≤ mois du plus ancien avis récupéré sont **incomplets** et exclus des séries (note UI), **sauf** si tout a été récupéré (nb stocké ≥ `reviews_count` total renvoyé par l'API). S'applique aussi à la série « ma fiche ».
7. Avis concurrents dans une **table séparée** `competitor_reviews` — jamais mêlés à `reviews` (zéro fuite dans widgets/dashboard/tags/KPIs). On stocke auteur/note/texte/avatar (déjà dans la réponse API, coût nul) → ouvre « lire les avis d'un concurrent » en v2.
8. Concurrent **retiré** de la liste → synchro stoppée, **données conservées** (ré-ajout = historique intact + rattrapage incrémental).
9. **Courbes : mêmes style et palette** que le positionnement — réutiliser `TrendChart` + `LINE_COLORS` de `frontend/src/components/GeogridTrendChart.jsx`, avec axe Y **normal** (un avis de plus = mieux ; pas d'inversion contrairement aux rangs).

## 3. Modèle de données (migrations 47-49)

- **47 — `competitor_reviews`** : `id` UUID PK, `business_id` NOT NULL (isolation, règle n°1), `location_id` FK `locations` CASCADE, `place_id` NOT NULL, `external_id` NOT NULL, `author_name`, `author_image_url`, `rating` INT, `text` TEXT, `published_at`, `created_at`.
  **Unique `(location_id, place_id, external_id)`** (upsert), index `(location_id, place_id, published_at)` (GROUP BY mois).
- **48 — `review_competitor_tracking`** : `id`, `business_id`, `location_id` FK CASCADE, `place_id`, `name` (copie au moment du suivi), `total_reviews_count`, `avg_rating` (snapshots API), `last_synced_at`, `next_sync_at`, `backfilled_at`, `created_at`. **Unique `(location_id, place_id)`**.
  1 ligne = 1 concurrent **actuellement suivi** — miroir de la liste geogrid, réconcilié par le cron (jamais écrit depuis le module rank-tracking).
- **49 — `review_sync_jobs.competitor_place_id`** STRING nullable (NULL = la fiche du business elle-même).

⚠️ `geogrid_competitors` n'a **ni lat/lng ni location_id** (`business_id`/`config_id`/`place_id`/`name`/`active`). Localisation résolue via `geogrid_configs.location_id`. L'appel DataForSEO utilise les **coordonnées de la localisation** (le `place_id` identifie exactement la fiche concurrente ; `location_coordinate` reste **obligatoire** — piège connu session 21). **À valider en réel dès AC1.**

## 4. Synchronisation — extension du cron existant (pas de 2ᵉ cron)

Dans `jobs/sync-reviews.js`, chaque tick (60 s), après le flux « ma fiche » :

1. **Réconciliation** : pour chaque business avec `module_quotas.reviews.enabled` → localisations → concurrents geogrid **actifs** (via config) vs lignes de tracking : créer les manquantes (`next_sync_at` NULL = due immédiatement → backfill), supprimer celles dont le concurrent a quitté la liste (`competitor_reviews` conservés). Auto-réparateur, même esprit que `closeFinishedRuns`.
2. **Enqueue des dues** : mêmes batch/étalement que les fiches, jobs portant `competitor_place_id`.
3. **Poll partagé** : un seul `tasks_ready` pour tout ; `resolveJob` branche sur `competitor_place_id` → upsert `competitor_reviews` + maj tracking (`total_reviews_count`/`avg_rating` depuis la réponse), sinon flux « ma fiche » inchangé.

## 5. API

- **`GET /api/v1/reviews/competitors/stats?business_id&location_id&year`** →
  ```
  { year, available_years,
    series: [ { key: 'me' | place_id, name, months: [{ month: '2026-01', count }, ×12],
                complete_from: 'YYYY-MM' | null, total_reviews_count, avg_rating } ] }
  ```
  Agrégat **SQL** (`GROUP BY date_trunc('month', published_at)`) — « me » depuis `reviews` (scopé localisation), concurrents depuis `competitor_reviews` joints au tracking. Rien de volumineux envoyé au front. `available_years` dérivé du plus ancien avis (alimente le sélecteur d'année).
- **Gestion de la liste : réutilise les endpoints G7** — `GET/POST/DELETE /api/v1/rank-tracking/competitors` + `GET /competitors/detected` (suggestions). **Aucun endpoint d'écriture nouveau** (liste partagée). L'ajout depuis la page Avis écrit donc la liste du positionnement (assumé ; le `recompute` auto post-ajout existe déjà, G9.3).

## 6. UI (AC3)

- Sidebar AVIS → « **Concurrents** » (`/reviews/concurrents`, lazy). *(Deux entrées « Concurrents » coexistent — sections AVIS et POSITIONNEMENT : contextuellement clair.)*
- **Page** (scopée localisation, sélecteur en haut, défaut = localisation active) :
  1. **Bloc gestion** : concurrents suivis (nom, note, total avis, dernière synchro), compteur quota `x/y`, ajout via `PlaceSearch` (remontage par `key`, pattern G8.3), suggestions « détectés », mention « Liste partagée avec le Positionnement ».
  2. **Carte « Ce mois-ci »** : ma fiche vs meilleur concurrent, delta vert/rouge — l'objectif produit en un coup d'œil.
  3. **Courbe 12 mois** : multi-séries (ma fiche + concurrents), sélecteur d'**année** (défaut = en cours), `TrendChart` étendu par props (`yReversed=false`, `yLabel="Avis reçus"` — défauts actuels conservés → **zéro régression** sur Suivi/Concurrents geogrid).
  4. **Tableau mensuel** : mois × séries, ma fiche en premier (gras), meilleur du mois surligné.
- **États** : gating (module reviews absent → CTA plan) · liste vide (CTA ajouter + détectés) · première synchro en cours (backfill priority ~1 min → message + rafraîchissement) · note de complétude si des mois sont tronqués.

## 7. Coûts (tarifs validés en réel, session 21)

| Poste | Coût |
|---|---|
| Backfill à l'ajout (200 avis, priority) | $0,03 one-shot |
| Quotidien (depth 10, standard) | $0,00075/j ≈ **$0,023/mois/concurrent** |
| Localisation Agence (10 concurrents) | ≈ **$0,23/mois** + backfills |

Facturation au depth **demandé** (par tranche de 10), pas au nombre retourné — ne pas gonfler les depths.

## 8. Sessions de développement

| # | Session | Contenu | Vérification |
|---|---------|---------|--------------|
| **AC1** | Backend — données & synchro | Migrations 47-49, modèles, réconciliation + enqueue + branche `resolveJob`, backfill priority / quotidien standard | `node --check`, migrations, **test réel DataForSEO sur 1 concurrent** (valide place_id concurrent + coordonnées de la localisation), backend redémarré |
| **AC2** | Backend — stats mensuelles | Endpoint `/stats` (agrégat SQL, complétude, série « ma fiche », `available_years`) | Testé contre les vraies données AC1 |
| **AC3** | Frontend — page Concurrents (avis) | Sidebar + page complète + extension `TrendChart` par props | Preview réel + **non-régression des courbes geogrid** |

Fin de chaque session : checklist habituelle (`PROGRESS.md`, `CLAUDE.md` ; + `PLAN_SESSIONS.md`/cahier si le périmètre bouge).

## 9. Points ouverts & évolutions

- **À valider en AC1** : DataForSEO accepte bien `place_id` d'un concurrent + `location_coordinate` de *notre* fiche (attendu : oui, le place_id prime — coût du test : négligeable).
- **Évolution prévue** (décision utilisateur « pour l'instant ») : liste de concurrents **dédiée** au module avis (table propre + import depuis le positionnement) — ne changera que `getTrackedCompetitors()` et l'UI de gestion, les données étant déjà découplées par `place_id`.
- v2 possibles : lecture des avis des concurrents (texte déjà stocké), comparaison de note moyenne, alerte « un concurrent vous a dépassé ce mois-ci » (brique du futur rapport email).
