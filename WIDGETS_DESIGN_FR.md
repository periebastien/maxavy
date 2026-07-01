# WIDGETS — Design system & référence

> Document de référence du catalogue de widgets Locagain (badges + carrousels d'avis Google).
> Sert à : revenir facilement sur les designs, créer de nouveaux widgets, faire évoluer la config.
> Dernière mise à jour : 2026-06-30.
> Voir aussi : `PROGRESS.md` (sessions 26→28), `CAHIER_CHARGES_MVP_EXTENSIBLE_FR.md` §MODULE 8.

---

## 1. Principe

- Un widget = une ligne de la table `widgets` : `type` ENUM(`badge`|`carousel`) + `style` (dans `config`) + `config` JSONB + `location_id`/`tag_id` (source des avis).
- `type` = **discriminant** (quel moteur de rendu charger). `style` = la **variante** dans ce type.
- Tout l'aspect est piloté par `config` → **aucune migration** pour ajouter une option, juste une clé de config + sa prise en compte dans le rendu.
- Avatars = **initiales** dérivées de `author_name` (couleur = hash déterministe du nom). Aucune photo stockée.
- Rendu embarqué isolé : **Shadow DOM**, classes préfixées `lcg-`, étoiles SVG inline, **zéro asset tiers** (règle anti-fuite, voir §6).

---

## 2. Catalogue

| Type | `style` | Nom | Usage type |
|------|---------|-----|------------|
| `badge` | `compact` | Badge compact (pilule) | header/footer, à côté d'un CTA — avatars + 1 étoile or + « 4,6 Google \| 25 avis » |
| `badge` | `framed` | Badge encadré (carte) | section réassurance — avatars + « Excellent » + 5 étoiles + « 4,6 sur 5 · 25 avis Google » |
| `carousel` | `slider` | Slider défilant | beaucoup d'avis en peu de hauteur, flèches + points, autoplay optionnel |
| `carousel` | `grid` | Mur d'avis (grille) | page « Avis » dédiée, statique, fort en SEO, « Voir plus » |
| `carousel` | `list` | Liste verticale | colonne étroite (sidebar, contact, tarifs), sobre |

Reportés post-MVP : `marquee` (bandeau défilant continu), `spotlight` (avis vedette), `masonry` (mosaïque) — accessibilité fragile / sur-complexité.

---

## 3. Modèle de configuration (source de vérité)

Casse **camelCase**, forme imbriquée `{ version, style, common{}, badge{}, carousel{} }`. Les deux sous-objets `badge` et `carousel` sont toujours conservés (basculer de famille sans reperdre les réglages). Clés inconnues ignorées (rétro-compat). `mergeDefaults(type, config)` complète à la création **et** à la lecture publique.

```json
{
  "version": 1,
  "style": "compact",
  "common": {
    "theme": "light",
    "lang": "fr",
    "minRating": 0,

    "containerPadding": 16,
    "backgroundColor": "auto",
    "fontFamily": "inherit",
    "textColor": "auto",
    "mutedColor": "auto",
    "starColor": "#FBBC04",
    "borderColor": "auto",
    "accentColor": "#7C5CFC",

    "showGoogleLogo": true,
    "showGoogleLabel": true,
    "googleUrl": "",
    "showPoweredBy": true
  },
  "badge": {
    "shape": "pill",
    "size": "medium",
    "align": "left",
    "showShadow": true,
    "showAvatars": true,
    "avatarsCount": 4,
    "showStars": true,
    "starStyle": "fractional",
    "showRatingValue": true,
    "showReviewCount": true,
    "qualityLabel": "auto",
    "ctaText": ""
  },
  "carousel": {
    "cardsDesktop": 3,
    "cardsMobile": 1,
    "autoplay": true,
    "intervalMs": 4000,
    "pauseOnHover": true,
    "showArrows": true,
    "showDots": true,
    "showAvatar": true,
    "showAuthorName": true,
    "showDate": true,
    "dateFormat": "relative",
    "showStars": true,
    "maxChars": 180,
    "showReadMore": true,
    "requireText": false,
    "sort": "recent",
    "limit": 20,
    "showHeader": true,
    "cardRadius": 12,
    "cardShadow": "soft",
    "gap": 16
  }
}
```

### 3.1 `common` — apparence & couleurs (tous les widgets)

| key | label | type | défaut | valeurs / bornes | contrôle |
|-----|-------|------|--------|------------------|----------|
| `theme` | Thème | enum | `light` | `light` `dark` `auto` | palette globale claire/sombre (`auto` = préférence visiteur) |
| `lang` | Langue | enum | `fr` | `fr` `en` `auto` | libellés + format dates et nombres (virgule décimale en FR) |
| `minRating` | Note minimale | number | `0` | 0–5 | n'affiche/compte que les avis ≥ seuil (filtre **symétrique** note moyenne + total + liste) |
| `containerPadding` | Marge intérieure | number | `16` | 0–64 (px) | espacement interne du conteneur (`.lcg-wrap` badge / `.lcg-car` carrousel) |
| `backgroundColor` | Couleur de fond | color | `auto` | `auto` · `transparent` · `#hex` | fond du widget — **`transparent`** épouse le fond du site ; `auto` = surface du thème (blanc clair / panneau sombre) |
| `fontFamily` | Police | enum | `inherit` | `inherit` `system` `inter` `roboto` `poppins` `georgia` | **`inherit`** = police du site ; les autres chargées via Google Fonts dans l'embed |
| `textColor` | Couleur du texte | color | `auto` | `auto` · `#hex` | texte principal (`auto` = dérivé du thème) |
| `mutedColor` | Couleur texte secondaire | color | `auto` | `auto` · `#hex` | dates, méta |
| `starColor` | Couleur des étoiles | color | `#FBBC04` | `#hex` | étoiles (défaut or Google) |
| `borderColor` | Couleur des bordures | color | `auto` | `auto` · `transparent` · `#hex` | bordures pilule/cartes — `transparent` = sans bordure |
| `accentColor` | Couleur d'accent | color | `#7C5CFC` | `#hex` | flèches + points du carrousel (jamais les étoiles ni le badge) |
| `showGoogleLogo` | Logo Google | bool | `true` | | affiche le « G » Google |
| `showGoogleLabel` | Mention « Google » | bool | `true` | | « Google » à côté de la note |
| `googleUrl` | Lien Google | text | `""` | | vide = dérivé de `Location.google_place_id` ; `null` si widget multi-localisations (non cliquable) |
| `showPoweredBy` | « Propulsé par Locagain » | bool | `true` | | **verrouillé `true` côté serveur en plan gratuit** (levier commercial) |

### 3.2 `badge`

| key | label | type | défaut | valeurs / bornes | s'applique à |
|-----|-------|------|--------|------------------|--------------|
| `shape` | Forme | enum | `pill` | `pill` `rounded` `square` | compact→`pill`, framed→`rounded` |
| `size` | Taille | enum | `medium` | `small` `medium` `large` | both |
| `align` | Alignement | enum | `center` | `left` `center` `right` | positionne le badge dans son conteneur — le bloc « Propulsé par Locagain » reste **toujours centré sous le badge lui-même** (jamais flush sur son bord) |
| `showShadow` | Ombre | bool | `true` | | both |
| `showAvatars` | Avatars | bool | `true` | | both |
| `avatarsCount` | Nombre d'avatars | number | `4` | 1–8 (borné à `reviews.length`) | both |
| `showStars` | Étoiles | bool | `true` | | compact=1 étoile, framed=5 |
| `starStyle` | Style étoiles | enum | `fractional` | `fractional` `rounded` | framed |
| `showRatingValue` | Note chiffrée | bool | `true` | | both |
| `showReviewCount` | Nombre d'avis | bool | `true` | | both |
| `qualityLabel` | Libellé qualitatif | text | `auto` | `auto` · `""` · texte libre | framed (`auto` : ≥4,5 Excellent, ≥4 Très bien…) |
| `ctaText` | Texte du lien | text | `""` | | défaut « Voir nos avis » |

### 3.3 `carousel`

| key | label | type | défaut | valeurs / bornes | s'applique à |
|-----|-------|------|--------|------------------|--------------|
| `cardsDesktop` | Cartes (desktop) | number | `3` | 1–6 | slider, grid |
| `cardsMobile` | Cartes (mobile) | number | `1` | 1–3 | slider, grid |
| `autoplay` | Défilement auto | bool | `true` | | slider |
| `intervalMs` | Vitesse (ms) | number | `4000` | 1000–15000 | slider |
| `pauseOnHover` | Pause au survol | bool | `true` | | slider |
| `showArrows` | Flèches | bool | `true` | | slider |
| `showDots` | Points | bool | `true` | | slider |
| `showAvatar` | Avatar | bool | `true` | | all |
| `showAuthorName` | Nom | bool | `true` | | all |
| `showDate` | Date | bool | `true` | | all |
| `dateFormat` | Format date | enum | `relative` | `relative` `absolute` | all |
| `showStars` | Étoiles | bool | `true` | | all |
| `maxChars` | Longueur max texte | number | `180` | 0–1000 (0 = intégral) | all |
| `showReadMore` | « Lire plus » | bool | `true` | | all |
| `requireText` | Masquer avis sans texte | bool | `false` | | all |
| `sort` | Tri | enum | `recent` | `recent` `highest` `lowest` `random` | all |
| `limit` | Nombre d'avis | number | `20` | 1–50 (cap dur serveur 50) | all |
| `showHeader` | En-tête récap | bool | `true` | | all |
| `cardRadius` | Arrondi cartes | number | `12` | 0–32 | all |
| `cardShadow` | Ombre cartes | enum | `soft` | `none` `soft` `medium` `strong` | all |
| `gap` | Espacement | number | `16` | 0–48 | all |

---

## 4. Conventions de couleurs & polices

- **Étoiles** : or Google `#FBBC04` par défaut (`starColor`). Modifiable.
- **Accent** (violet `#7C5CFC`) : réservé aux flèches/points du carrousel et à l'UI builder. **Jamais** les étoiles ni le badge.
- **`auto`** : `backgroundColor`, `textColor`, `mutedColor`, `borderColor` se dérivent du `theme`. L'utilisateur peut surcharger chacun par un hex.
- **`transparent`** : valable pour `backgroundColor` (épouse le site) et `borderColor` (sans bordure).
- **Police** : `inherit` (police du site, défaut) ; sinon une police de la liste chargée depuis Google Fonts dans l'embed (poids minimal, asynchrone).
- Mapping rendu : l'embed pose des **CSS custom properties** sur la racine du widget (`--lcg-bg`, `--lcg-text`, `--lcg-muted`, `--lcg-star`, `--lcg-border`, `--lcg-accent`, `--lcg-font`) depuis la config ; les gabarits ne lisent que ces variables.

---

## 5. Gabarits HTML (réutilisables)

Préfixe `lcg-` partout. Les couleurs passent par les variables CSS ci-dessus.

### 5.1 Badge compact (validé — repris de l'image client, dé-marqué)

```html
<div class="lcg-rb">
  <a class="lcg-rb__link" href="GOOGLE_REVIEWS_URL" target="_blank" rel="noopener nofollow" aria-label="4,6 sur 5 — 25 avis Google">
    <span class="lcg-rb__avatars" aria-hidden="true">
      <span class="lcg-rb__avatar" style="background:#C0673C">O</span>
      <span class="lcg-rb__avatar" style="background:#8C9BA5">Y</span>
      <span class="lcg-rb__avatar" style="background:#6E8B8B">Y</span>
      <span class="lcg-rb__avatar" style="background:#6E5A4E">V</span>
      <span class="lcg-rb__avatar" style="background:#9A6A4F">R</span>
    </span>
    <svg class="lcg-rb__star" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.785 1.401 8.169L12 18.896l-7.335 3.868 1.401-8.169L.132 9.21l8.2-1.192z"/>
    </svg>
    <strong class="lcg-rb__summary">4,6 Google<span class="lcg-rb__sep"></span>25 avis</strong>
  </a>
</div>

<style>
.lcg-rb{display:inline-block;--lcg-bg:#fff;--lcg-text:#1a1a1a;--lcg-border:#e6e6e6;--lcg-star:#FBBC04;--lcg-font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-family:var(--lcg-font)}
.lcg-rb *{box-sizing:border-box}
.lcg-rb__link{display:inline-flex;align-items:center;gap:12px;padding:7px 16px 7px 12px;background:var(--lcg-bg);border:1px solid var(--lcg-border);border-radius:999px;text-decoration:none;transition:box-shadow .15s}
.lcg-rb__link:hover{box-shadow:0 2px 10px rgba(0,0,0,.08)}
.lcg-rb__avatars{display:inline-flex}
.lcg-rb__avatar{width:30px;height:30px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;border:2px solid var(--lcg-bg)}
.lcg-rb__avatar+.lcg-rb__avatar{margin-left:-10px}
.lcg-rb__star{flex:none;fill:var(--lcg-star)}
.lcg-rb__summary{font-size:15px;font-weight:500;color:var(--lcg-text);white-space:nowrap}
.lcg-rb__sep{display:inline-block;width:1px;height:13px;background:var(--lcg-border);margin:0 8px;vertical-align:-2px}
</style>
```

### 5.2 Carte d'avis (brique commune slider / grid / list)

```html
<article class="lcg-rc">
  <header class="lcg-rc__head">
    <span class="lcg-rc__avatar" style="background:#C0673C">O</span>
    <div class="lcg-rc__id">
      <p class="lcg-rc__name">Oumaima B.</p>
      <p class="lcg-rc__date">il y a 2 semaines</p>
    </div>
    <!-- logo Google « G » SVG inline si showGoogleLogo -->
  </header>
  <div class="lcg-rc__stars" aria-label="5 sur 5"><!-- N étoiles SVG --></div>
  <p class="lcg-rc__text">Accueil parfait et équipe très professionnelle…</p>
</article>
```

```css
.lcg-rc{background:var(--lcg-bg);border:1px solid var(--lcg-border);border-radius:var(--lcg-radius,12px);padding:14px 16px;font-family:var(--lcg-font);color:var(--lcg-text)}
.lcg-rc__head{display:flex;align-items:center;gap:10px}
.lcg-rc__avatar{width:36px;height:36px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px}
.lcg-rc__name{margin:0;font-size:14px;font-weight:500}
.lcg-rc__date{margin:0;font-size:12px;color:var(--lcg-muted)}
.lcg-rc__text{margin:8px 0 0;font-size:13px;line-height:1.55;color:var(--lcg-muted)}
.lcg-rc__stars svg{fill:var(--lcg-star)}
```

Le conteneur change selon `style` : `slider` (rangée + flèches `--lcg-accent` + points), `grid` (CSS grid `repeat(auto-fit,minmax)`), `list` (empilé, séparé par filet `--lcg-border`).

---

## 6. Anti-fuite d'origine (règle stricte)

- Préfixe **`lcg-`** sur **toutes** les classes. Aucune classe `ti-`, aucun `cdn.trustindex`, aucun sprite tiers.
- **Shadow DOM** : le CSS du widget n'affecte pas le site hôte et inversement.
- Étoiles + logo Google = **SVG inline**. Aucun asset externe (hors Google Fonts si police non-`inherit`).
- Avant chaque commit widgets : `grep -ri "trustindex\|ti-\|cdn.trustindex"` doit être vide.

---

## 7. Ajouter / faire évoluer un widget

1. Nouveau **style** dans un type existant : ajouter la clé à `style`, le rendu dans le moteur (`embed.builder.js`), les options éventuelles dans le sous-objet de config + `widget.defaults.js`, et la fiche dans le builder (`widget-schema.js`). Pas de migration.
2. Nouveau **type** : ajouter la valeur à l'ENUM `widgets.type` (migration), un moteur de rendu, un sous-objet de config.
3. Nouvelle **option** : clé dans le bon sous-objet + défaut dans `widget.defaults.js` + bornage dans `update()` + champ dans le builder + prise en compte dans le rendu.
4. Toujours mettre à jour ce fichier (catalogue / tableaux §3) + `PROGRESS.md`.

---

## 8. Évolutions backend liées (sessions 27/28)

- `widget.defaults.js` : `DEFAULTS` par type/style + `mergeDefaults(type, config)` (appliqué à `create()` et `getPublic()`).
- `getPublic` : filtre `minRating` symétrique (count + AVG + liste) ; `sort` ; `limit` borné `min(config,50)` ; expose l'`id` de l'avis (clés stables) — jamais `external_id`/`reply_text`/email ; `googleUrl` dérivé de `Location.google_place_id` (null si pas de location) ; force `showPoweredBy=true` en plan gratuit sans exposer le plan.
- `update()` : bornage des nombres + rejet des clés hors-schéma dans le JSONB.
- `widget.controller` : `Cache-Control` sur `/public` (120 s) et `/embed.js` (300 s) + ETag sur `updated_at`.
- Réponse `/public` finale : `{ id, type, config, locationId, tagId, googleUrl, aggregate:{count,average}, reviews:[{id, author_name, rating, text, published_at}] }`.
- **Aucune migration** (colonnes `type`/`config`/`embed_code`/`location_id`/`tag_id` déjà en place).
