// Schéma de configuration des widgets — miroir de backend/src/modules/widgets/widget.defaults.js.
// Source de vérité du builder (champs + défauts). Voir WIDGETS_DESIGN_FR.md.

export const WIDGET_TYPES = [
  {
    type: 'badge',
    name: 'Badge',
    desc: 'Pastille de note compacte',
    styles: [
      { key: 'compact', name: 'Compact', desc: 'Pilule : avatars + note + « Google »' },
      { key: 'framed', name: 'Encadré', desc: 'Carte : « Excellent » + 5 étoiles' },
    ],
  },
  {
    type: 'carousel',
    name: 'Carrousel',
    desc: 'Affichage des avis',
    styles: [
      { key: 'slider', name: 'Slider', desc: 'Cartes défilantes, flèches + points' },
      { key: 'grid', name: 'Grille', desc: 'Mur d\'avis statique' },
      { key: 'list', name: 'Liste', desc: 'Empilé, colonne étroite' },
    ],
  },
]

export const DEFAULT_STYLE = { badge: 'compact', carousel: 'slider' }

const COMMON = {
  theme: 'light', lang: 'fr', minRating: 0, containerPadding: 16,
  backgroundColor: 'auto', fontFamily: 'inherit', textColor: 'auto', mutedColor: 'auto',
  starColor: '#FBBC04', borderColor: 'auto', accentColor: '#7C5CFC',
  showGoogleLogo: true, showGoogleLabel: true, googleUrl: '', showPoweredBy: true,
}
const BADGE = {
  shape: 'pill', size: 'medium', align: 'center', showShadow: true,
  showAvatars: true, avatarsCount: 4, showStars: true, starStyle: 'fractional',
  showRatingValue: true, showReviewCount: true, qualityLabel: 'auto', ctaText: '',
}
const CAROUSEL = {
  cardsDesktop: 3, cardsMobile: 1, autoplay: true, intervalMs: 4000, pauseOnHover: true,
  showArrows: true, showDots: true, showAvatar: true, showAuthorName: true, showDate: true,
  dateFormat: 'relative', showStars: true, maxChars: 180, showReadMore: true, requireText: false,
  sort: 'recent', limit: 20, showHeader: true, cardRadius: 12, cardShadow: 'soft', gap: 16,
}

export function defaultConfig(type) {
  return {
    version: 1,
    style: DEFAULT_STYLE[type] || 'slider',
    common: { ...COMMON },
    badge: { ...BADGE },
    carousel: { ...CAROUSEL },
  }
}

// Champs du builder. scope: common|badge|carousel ; section: apparence|contenu|comportement.
// styles (optionnel) = ne montrer que pour ces styles.
export const FIELDS = [
  // ---- COMMUN · apparence
  { scope: 'common', key: 'theme', label: 'Thème', type: 'enum', section: 'apparence', options: [['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Auto']] },
  { scope: 'common', key: 'backgroundColor', label: 'Fond', type: 'color', section: 'apparence', allowAuto: true, allowTransparent: true },
  { scope: 'common', key: 'containerPadding', label: 'Marge intérieure (px)', type: 'number', section: 'apparence', min: 0, max: 64, step: 1 },
  { scope: 'common', key: 'fontFamily', label: 'Police', type: 'enum', section: 'apparence', note: '« Du site » = police du site où le widget est intégré', options: [['inherit', 'Du site'], ['system', 'Système'], ['inter', 'Inter'], ['roboto', 'Roboto'], ['poppins', 'Poppins'], ['georgia', 'Georgia']] },
  { scope: 'common', key: 'textColor', label: 'Texte', type: 'color', section: 'apparence', allowAuto: true },
  { scope: 'common', key: 'mutedColor', label: 'Texte secondaire', type: 'color', section: 'apparence', allowAuto: true },
  { scope: 'common', key: 'starColor', label: 'Étoiles', type: 'color', section: 'apparence' },
  { scope: 'common', key: 'borderColor', label: 'Bordures', type: 'color', section: 'apparence', allowAuto: true, allowTransparent: true, transparentLabel: 'Aucune' },
  { scope: 'common', key: 'accentColor', label: 'Accent (flèches/points)', type: 'color', section: 'apparence', styles: ['slider'] },
  // ---- COMMUN · contenu
  { scope: 'common', key: 'minRating', label: 'Note minimale affichée', type: 'number', section: 'contenu', min: 0, max: 5, step: 1 },
  { scope: 'common', key: 'showGoogleLogo', label: 'Logo Google', type: 'bool', section: 'contenu' },
  { scope: 'common', key: 'showGoogleLabel', label: 'Mention « Google »', type: 'bool', section: 'contenu' },
  { scope: 'common', key: 'showPoweredBy', label: 'Propulsé par GMB Manager', type: 'bool', section: 'contenu', note: 'Verrouillé en plan gratuit' },

  // ---- BADGE · apparence
  { scope: 'badge', key: 'shape', label: 'Forme', type: 'enum', section: 'apparence', options: [['pill', 'Pilule'], ['rounded', 'Arrondi'], ['square', 'Carré']] },
  { scope: 'badge', key: 'size', label: 'Taille', type: 'enum', section: 'apparence', options: [['small', 'Petite'], ['medium', 'Moyenne'], ['large', 'Grande']] },
  { scope: 'badge', key: 'align', label: 'Alignement', type: 'enum', section: 'apparence', options: [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']] },
  { scope: 'badge', key: 'showShadow', label: 'Ombre', type: 'bool', section: 'apparence' },
  // ---- BADGE · contenu
  { scope: 'badge', key: 'showAvatars', label: 'Avatars', type: 'bool', section: 'contenu' },
  { scope: 'badge', key: 'avatarsCount', label: 'Nombre d\'avatars', type: 'number', section: 'contenu', min: 1, max: 8, step: 1 },
  { scope: 'badge', key: 'showStars', label: 'Étoiles', type: 'bool', section: 'contenu' },
  { scope: 'badge', key: 'showRatingValue', label: 'Note chiffrée', type: 'bool', section: 'contenu' },
  { scope: 'badge', key: 'showReviewCount', label: 'Nombre d\'avis', type: 'bool', section: 'contenu' },
  { scope: 'badge', key: 'starStyle', label: 'Style étoiles', type: 'enum', section: 'contenu', styles: ['framed'], options: [['fractional', 'Fractionnaire'], ['rounded', 'Arrondi']] },
  { scope: 'badge', key: 'qualityLabel', label: 'Libellé (auto / texte)', type: 'text', section: 'contenu', styles: ['framed'] },
  { scope: 'badge', key: 'ctaText', label: 'Texte du lien (vide = aucun)', type: 'text', section: 'contenu' },

  // ---- CARROUSEL · apparence
  { scope: 'carousel', key: 'cardsDesktop', label: 'Cartes (desktop)', type: 'number', section: 'apparence', min: 1, max: 6, step: 1, styles: ['slider', 'grid'] },
  { scope: 'carousel', key: 'cardsMobile', label: 'Cartes (mobile)', type: 'number', section: 'apparence', min: 1, max: 3, step: 1, styles: ['slider', 'grid'] },
  { scope: 'carousel', key: 'cardRadius', label: 'Arrondi des cartes', type: 'number', section: 'apparence', min: 0, max: 32, step: 1 },
  { scope: 'carousel', key: 'cardShadow', label: 'Ombre des cartes', type: 'enum', section: 'apparence', options: [['none', 'Aucune'], ['soft', 'Légère'], ['medium', 'Moyenne'], ['strong', 'Forte']] },
  { scope: 'carousel', key: 'gap', label: 'Espacement', type: 'number', section: 'apparence', min: 0, max: 48, step: 1 },
  // ---- CARROUSEL · contenu
  { scope: 'carousel', key: 'showHeader', label: 'En-tête récap', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'showAvatar', label: 'Avatar', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'showAuthorName', label: 'Nom', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'showDate', label: 'Date', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'dateFormat', label: 'Format date', type: 'enum', section: 'contenu', options: [['relative', 'Relative'], ['absolute', 'Absolue']] },
  { scope: 'carousel', key: 'showStars', label: 'Étoiles', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'maxChars', label: 'Longueur max (0 = tout)', type: 'number', section: 'contenu', min: 0, max: 1000, step: 10 },
  { scope: 'carousel', key: 'showReadMore', label: 'Bouton « Lire plus »', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'requireText', label: 'Masquer avis sans texte', type: 'bool', section: 'contenu' },
  { scope: 'carousel', key: 'sort', label: 'Tri', type: 'enum', section: 'contenu', options: [['recent', 'Récents'], ['highest', 'Mieux notés'], ['lowest', 'Moins notés'], ['random', 'Aléatoire']] },
  { scope: 'carousel', key: 'limit', label: 'Nombre d\'avis', type: 'number', section: 'contenu', min: 1, max: 50, step: 1 },
  // ---- CARROUSEL · comportement (slider)
  { scope: 'carousel', key: 'autoplay', label: 'Défilement auto', type: 'bool', section: 'comportement', styles: ['slider'] },
  { scope: 'carousel', key: 'intervalMs', label: 'Vitesse (ms)', type: 'number', section: 'comportement', min: 1000, max: 15000, step: 500, styles: ['slider'] },
  { scope: 'carousel', key: 'pauseOnHover', label: 'Pause au survol', type: 'bool', section: 'comportement', styles: ['slider'] },
  { scope: 'carousel', key: 'showArrows', label: 'Flèches', type: 'bool', section: 'comportement', styles: ['slider'] },
  { scope: 'carousel', key: 'showDots', label: 'Points', type: 'bool', section: 'comportement', styles: ['slider'] },
]

export const SECTIONS = [
  ['apparence', 'Apparence'],
  ['contenu', 'Contenu'],
  ['comportement', 'Comportement'],
]

// Filtre les champs pertinents pour un type + style donné.
export function fieldsFor(type, style) {
  return FIELDS.filter(f => {
    if (f.scope !== 'common' && f.scope !== type) return false
    if (f.styles && !f.styles.includes(style)) return false
    return true
  })
}
