const COMMON_DEFAULTS = {
  theme: 'light',
  lang: 'fr',
  minRating: 0,
  backgroundColor: 'auto',
  fontFamily: 'inherit',
  textColor: 'auto',
  mutedColor: 'auto',
  starColor: '#FBBC04',
  borderColor: 'auto',
  accentColor: '#7C5CFC',
  showGoogleLogo: true,
  showGoogleLabel: true,
  googleUrl: '',
  showPoweredBy: true,
}

const BADGE_DEFAULTS = {
  shape: 'pill',
  size: 'medium',
  align: 'left',
  showShadow: true,
  showAvatars: true,
  avatarsCount: 4,
  showStars: true,
  starStyle: 'fractional',
  showRatingValue: true,
  showReviewCount: true,
  qualityLabel: 'auto',
  ctaText: '',
}

const CAROUSEL_DEFAULTS = {
  cardsDesktop: 3,
  cardsMobile: 1,
  autoplay: true,
  intervalMs: 4000,
  pauseOnHover: true,
  showArrows: true,
  showDots: true,
  showAvatar: true,
  showAuthorName: true,
  showDate: true,
  dateFormat: 'relative',
  showStars: true,
  maxChars: 180,
  showReadMore: true,
  requireText: false,
  sort: 'recent',
  limit: 20,
  showHeader: true,
  cardRadius: 12,
  cardShadow: 'soft',
  gap: 16,
}

const STYLES = { badge: ['compact', 'framed'], carousel: ['slider', 'grid', 'list'] }
const DEFAULT_STYLE = { badge: 'compact', carousel: 'slider' }

const ENUMS = {
  theme: ['light', 'dark', 'auto'],
  lang: ['fr', 'en', 'auto'],
  fontFamily: ['inherit', 'system', 'inter', 'roboto', 'poppins', 'georgia'],
  shape: ['pill', 'rounded', 'square'],
  size: ['small', 'medium', 'large'],
  align: ['left', 'center', 'right'],
  starStyle: ['fractional', 'rounded'],
  dateFormat: ['relative', 'absolute'],
  sort: ['recent', 'highest', 'lowest', 'random'],
  cardShadow: ['none', 'soft', 'medium', 'strong'],
}

const NUM_BOUNDS = {
  minRating: [0, 5],
  avatarsCount: [1, 8],
  cardsDesktop: [1, 6],
  cardsMobile: [1, 3],
  intervalMs: [1000, 15000],
  maxChars: [0, 1000],
  limit: [1, 50],
  cardRadius: [0, 32],
  gap: [0, 48],
}

const COLOR_KEYS = new Set(['backgroundColor', 'textColor', 'mutedColor', 'starColor', 'borderColor', 'accentColor'])
const TEXT_MAX = { qualityLabel: 40, ctaText: 40, googleUrl: 300 }
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/

function sanitizeColor(val, def) {
  if (typeof val !== 'string') return def
  const v = val.trim()
  if (v === 'auto' || v === 'transparent' || HEX_RE.test(v)) return v
  return def
}

function sanitizeNum(key, val, def) {
  const [min, max] = NUM_BOUNDS[key]
  const n = parseInt(val, 10)
  if (Number.isNaN(n)) return def
  return Math.min(max, Math.max(min, n))
}

function sanitizeBool(val, def) {
  if (typeof val === 'boolean') return val
  if (val === 'true') return true
  if (val === 'false') return false
  return def
}

function sanitizeText(key, val, def) {
  if (typeof val !== 'string') return def
  const v = val.trim().slice(0, TEXT_MAX[key] || 80)
  if (key === 'googleUrl' && v && !/^https?:\/\//i.test(v)) return ''
  return v
}

function sanitizeKey(key, val, def) {
  if (COLOR_KEYS.has(key)) return sanitizeColor(val, def)
  if (NUM_BOUNDS[key]) return sanitizeNum(key, val, def)
  if (ENUMS[key]) return ENUMS[key].includes(val) ? val : def
  if (typeof def === 'string') return sanitizeText(key, val, def)
  if (typeof def === 'boolean') return sanitizeBool(val, def)
  return def
}

function sanitizeSection(defaults, input) {
  const src = input && typeof input === 'object' ? input : {}
  const out = {}
  for (const key of Object.keys(defaults)) {
    out[key] = key in src ? sanitizeKey(key, src[key], defaults[key]) : defaults[key]
  }
  return out
}

// Complète + assainit une config widget : ne garde que les clés connues, borne les nombres,
// valide les enums/couleurs, rejette les clés arbitraires. Appliqué à create/update/getPublic.
function mergeDefaults(type, config) {
  const cfg = config && typeof config === 'object' ? config : {}
  const styles = STYLES[type] || STYLES.carousel
  const style = styles.includes(cfg.style) ? cfg.style : (DEFAULT_STYLE[type] || styles[0])
  return {
    version: 1,
    style,
    common: sanitizeSection(COMMON_DEFAULTS, cfg.common),
    badge: sanitizeSection(BADGE_DEFAULTS, cfg.badge),
    carousel: sanitizeSection(CAROUSEL_DEFAULTS, cfg.carousel),
  }
}

module.exports = {
  mergeDefaults,
  STYLES,
  DEFAULT_STYLE,
  COMMON_DEFAULTS,
  BADGE_DEFAULTS,
  CAROUSEL_DEFAULTS,
}
