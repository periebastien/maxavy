// Moteur de rendu embarqué (vanilla, zéro dépendance). Sérialisé via Function.toString()
// et servi tel quel sur /api/v1/widgets/runtime.js. Source de vérité UNIQUE du rendu :
// utilisé par l'embed (/:id/embed.js) ET l'aperçu du builder. Classes préfixées lcg-.

function LOCAGAIN_RUNTIME() {
  var AV_COLORS = ['#C0673C', '#8C9BA5', '#6E8B8B', '#6E5A4E', '#9A6A4F', '#7C8A99', '#A08763', '#6E5A7A', '#5E8B7E', '#B06A6A']
  var STAR = 'M12 .587l3.668 7.431 8.2 1.192-5.934 5.785 1.401 8.169L12 18.896l-7.335 3.868 1.401-8.169L.132 9.21l8.2-1.192z'

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function initial(name) { var n = (name || '').trim(); return n ? n.charAt(0).toUpperCase() : '?' }
  function hashColor(name) {
    var s = name || '', h = 0
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return AV_COLORS[h % AV_COLORS.length]
  }
  function num1(lang, v) {
    try { return new Intl.NumberFormat(lang === 'en' ? 'en' : 'fr', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) }
    catch (e) { return String(v) }
  }
  function relDate(iso, lang) {
    if (!iso) return ''
    var d = new Date(iso); if (isNaN(d.getTime())) return ''
    var diff = (d.getTime() - Date.now()) / 1000, abs = Math.abs(diff)
    var units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
    try {
      var rtf = new Intl.RelativeTimeFormat(lang === 'en' ? 'en' : 'fr', { numeric: 'auto' })
      for (var i = 0; i < units.length; i++) {
        if (abs >= units[i][1] || units[i][0] === 'minute') return rtf.format(Math.round(diff / units[i][1]), units[i][0])
      }
    } catch (e) {}
    return d.toLocaleDateString(lang === 'en' ? 'en' : 'fr')
  }
  function absDate(iso, lang) {
    if (!iso) return ''
    var d = new Date(iso); if (isNaN(d.getTime())) return ''
    try { return d.toLocaleDateString(lang === 'en' ? 'en' : 'fr', { year: 'numeric', month: 'short', day: 'numeric' }) }
    catch (e) { return '' }
  }
  function dateStr(iso, cfg) {
    return cfg.carousel.dateFormat === 'absolute' ? absDate(iso, cfg.common.lang) : relDate(iso, cfg.common.lang)
  }
  function star(size, fill) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + fill + '" aria-hidden="true"><path d="' + STAR + '"/></svg>'
  }
  function starsRow(rating, color, size) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0)), out = ''
    for (var i = 1; i <= 5; i++) {
      if (r >= i) out += star(size, color)
      else if (r >= i - 0.5) out += '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="lcgh' + i + '"><stop offset="50%" stop-color="' + color + '"/><stop offset="50%" stop-color="#d8d8d8"/></linearGradient></defs><path fill="url(#lcgh' + i + ')" d="' + STAR + '"/></svg>'
      else out += star(size, '#d8d8d8')
    }
    return '<span class="lcg-stars">' + out + '</span>'
  }
  function googleG(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>'
  }
  function qualityText(avg, lang) {
    var en = lang === 'en'
    if (avg >= 4.5) return en ? 'Excellent' : 'Excellent'
    if (avg >= 4) return en ? 'Very good' : 'Très bien'
    if (avg >= 3) return en ? 'Good' : 'Bien'
    return en ? 'Reviews' : 'Avis'
  }
  function clamp(text, max) {
    var t = text || ''
    if (!max || t.length <= max) return { t: t, cut: false }
    return { t: t.slice(0, max).replace(/\s+\S*$/, '') + '…', cut: true }
  }

  function resolve(cfg) {
    var c = cfg.common
    var dark = c.theme === 'dark' || (c.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    function pick(v, l, d) { return v === 'auto' ? (dark ? d : l) : v }
    var fonts = {
      inherit: 'inherit',
      system: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      inter: '"Inter",sans-serif', roboto: '"Roboto",sans-serif', poppins: '"Poppins",sans-serif', georgia: 'Georgia,serif',
    }
    return {
      dark: dark,
      bg: pick(c.backgroundColor, '#ffffff', '#16181d'),
      text: pick(c.textColor, '#1a1a1a', '#f2f2f2'),
      muted: pick(c.mutedColor, '#777777', '#9aa0ab'),
      border: pick(c.borderColor, '#e6e6e6', '#2f333c'),
      star: c.starColor || '#FBBC04',
      accent: c.accentColor || '#7C5CFC',
      font: fonts[c.fontFamily] || 'inherit',
      fontKey: c.fontFamily,
    }
  }
  function loadFont(root, key) {
    var map = { inter: 'Inter:wght@400;500', roboto: 'Roboto:wght@400;500', poppins: 'Poppins:wght@400;500' }
    if (!map[key]) return
    var href = 'https://fonts.googleapis.com/css2?family=' + map[key] + '&display=swap'
    var host = root.host ? root : document.head
    if (host.querySelector && host.querySelector('link[data-lcgf="' + key + '"]')) return
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-lcgf', key)
    ;(root.host ? root : document.head).appendChild(l)
  }

  // Google : /a-/ = vraie photo de profil ; /a/ = avatar lettre généré (jamais affiché tel quel)
  function isCustomAvatar(url) { return !!url && url.indexOf('/a-/') !== -1 }
  function avatarEl(nm, img, borderColor, z) {
    var zs = z ? ';position:relative;z-index:' + z : ''
    if (isCustomAvatar(img)) {
      return '<img class="lcg-av lcg-av-img" src="' + esc(img) + '" alt="' + esc(nm || '') + '"'
        + ' loading="lazy" referrerpolicy="no-referrer" data-fb="' + esc(initial(nm)) + '" data-c="' + esc(hashColor(nm)) + '"'
        + ' style="border-color:' + borderColor + zs + '">'
    }
    return '<span class="lcg-av" style="background:' + hashColor(nm) + ';border-color:' + borderColor + zs + '">' + esc(initial(nm)) + '</span>'
  }
  function avatars(reviews, n, bg) {
    var k = Math.min(n, reviews.length), out = '', picked = [], i
    for (i = 0; i < reviews.length && picked.length < k; i++) {
      if (isCustomAvatar(reviews[i].author_image_url)) picked.push(reviews[i])
    }
    for (i = 0; i < reviews.length && picked.length < k; i++) {
      if (!isCustomAvatar(reviews[i].author_image_url)) picked.push(reviews[i])
    }
    for (i = 0; i < picked.length; i++) {
      out += avatarEl(picked[i].author_name, picked[i].author_image_url, bg, picked.length - i)
    }
    return '<span class="lcg-avs">' + out + '</span>'
  }

  function shadow(p) { return p === 'none' ? 'none' : p === 'strong' ? '0 6px 24px rgba(0,0,0,.16)' : p === 'medium' ? '0 4px 16px rgba(0,0,0,.10)' : '0 2px 10px rgba(0,0,0,.06)' }

  function baseCss(pal, cfg) {
    return '.lcg-root{all:initial;font-family:' + pal.font + ';color:' + pal.text + ';display:block;box-sizing:border-box;-webkit-font-smoothing:antialiased}'
      + '.lcg-root *{box-sizing:border-box}'
      + '.lcg-stars{display:inline-flex;gap:1px;vertical-align:middle}'
      + '.lcg-av{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;color:#fff;font-size:13px;font-weight:500;border:2px solid ' + pal.bg + '}'
      + '.lcg-av-img{object-fit:cover;background:#eaeaea;color:transparent}'
      + '.lcg-avs{display:inline-flex}.lcg-avs .lcg-av+.lcg-av{margin-left:-10px}'
      + '.lcg-link{color:inherit;text-decoration:none}'
      + '.lcg-pb{margin-top:8px;font-size:11px;color:' + pal.muted + ';text-align:center}'
      + '.lcg-pb a{color:' + pal.muted + ';text-decoration:none}'
  }

  // ---- BADGE ----
  function badgeHtml(payload, pal, pbHtml) {
    var cfg = payload.config, b = cfg.badge, c = cfg.common
    var avg = payload.aggregate.average, count = payload.aggregate.count
    var radius = b.shape === 'square' ? '6px' : b.shape === 'rounded' ? '12px' : '999px'
    var pad = b.size === 'large' ? '10px 20px' : b.size === 'small' ? '5px 12px' : '7px 16px'
    var fpad = b.size === 'large' ? '24px 38px' : b.size === 'small' ? '12px 20px' : '18px 30px'
    var fradius = b.shape === 'square' ? '6px' : b.shape === 'pill' ? '24px' : '14px'
    var starAvg = b.starStyle === 'rounded' ? Math.round(avg) : avg
    var inner = ''
    if (b.showAvatars) inner += avatars(payload.reviews, b.avatarsCount, pal.bg)
    if (payload.style === 'framed') {
      var stars = b.showStars ? starsRow(starAvg, pal.star, 18) : ''
      var label = b.qualityLabel === '' ? '' : '<div class="lcg-bf-label">' + esc(b.qualityLabel === 'auto' ? qualityText(avg, c.lang) : b.qualityLabel) + '</div>'
      var line = (b.showRatingValue ? num1(c.lang, avg) + (c.lang === 'en' ? ' out of 5' : ' sur 5') : '')
        + (b.showReviewCount ? (b.showRatingValue ? ' · ' : '') + count + (c.lang === 'en' ? ' Google reviews' : ' avis Google') : '')
      inner = '<div class="lcg-bf">' + inner + label + (stars ? '<div>' + stars + '</div>' : '') + (line ? '<div class="lcg-bf-line">' + line + '</div>' : '') + '</div>'
    } else {
      var star1 = b.showStars ? star(17, pal.star) : ''
      var txt = (b.showRatingValue ? num1(c.lang, avg) : '') + (c.showGoogleLabel ? ' Google' : '')
      var cnt = b.showReviewCount ? '<span class="lcg-sep"></span>' + count + (c.lang === 'en' ? ' reviews' : ' avis') : ''
      inner += star1 + '<strong class="lcg-bc-txt">' + esc(txt) + cnt + '</strong>'
    }
    var cpad = typeof cfg.common.containerPadding === 'number' ? cfg.common.containerPadding : 16
    var justify = b.align === 'center' ? 'center' : b.align === 'right' ? 'flex-end' : 'flex-start'
    var css = '.lcg-bc{display:inline-flex;align-items:center;gap:12px;padding:' + pad + ';background:' + pal.bg + ';border:1px solid ' + pal.border + ';border-radius:' + radius + ';box-shadow:' + (b.showShadow ? shadow('soft') : 'none') + '}'
      + '.lcg-bc-txt{font-size:15px;font-weight:500;color:' + pal.text + ';white-space:nowrap}'
      + '.lcg-sep{display:inline-block;width:1px;height:13px;background:' + pal.border + ';margin:0 8px;vertical-align:-2px}'
      + '.lcg-bf{display:inline-flex;flex-direction:column;align-items:center;gap:8px;padding:' + fpad + ';background:' + pal.bg + ';border:1px solid ' + pal.border + ';border-radius:' + fradius + ';box-shadow:' + (b.showShadow ? shadow('soft') : 'none') + ';text-align:center}'
      + '.lcg-bf-label{font-size:17px;font-weight:500;color:' + pal.text + '}'
      + '.lcg-bf-line{font-size:13px;color:' + pal.muted + '}'
      + '.lcg-wrap{display:flex;justify-content:' + justify + ';padding:' + cpad + 'px}'
      + '.lcg-wrap-inner{display:flex;flex-direction:column;align-items:center}'
      + '.lcg-cta{margin-top:6px;font-size:13px;font-weight:500;color:' + pal.muted + ';text-decoration:underline;text-align:center}'
      + '@media(max-width:480px){'
      + '.lcg-bc{gap:8px;padding:6px 12px}'
      + '.lcg-bc-txt{font-size:14px}'
      + '.lcg-avs .lcg-av:nth-child(n+4){display:none}'
      + '.lcg-sep{margin:0 6px}'
      + '}'
    var body = payload.style === 'framed'
      ? inner
      : '<span class="lcg-bc">' + inner + '</span>'
    if (b.ctaText && payload.googleUrl) body += '<div class="lcg-cta">' + esc(b.ctaText) + '</div>'
    if (payload.googleUrl) body = '<a class="lcg-link" href="' + esc(payload.googleUrl) + '" target="_blank" rel="noopener nofollow">' + body + '</a>'
    var content = '<div class="lcg-wrap"><div class="lcg-wrap-inner">' + body + (pbHtml || '') + '</div></div>'
    return { css: css, html: content }
  }

  // ---- CAROUSEL ----
  function reviewCard(r, cfg, pal) {
    var c = cfg.common, cw = cfg.carousel
    var head = ''
    if (cw.showAvatar) head += avatarEl(r.author_name, r.author_image_url, pal.bg)
    var idblock = ''
    if (cw.showAuthorName) idblock += '<p class="lcg-rc-name">' + esc(r.author_name || (c.lang === 'en' ? 'Google user' : 'Utilisateur Google')) + '</p>'
    var ds = cw.showDate ? dateStr(r.published_at, cfg) : ''
    if (ds) idblock += '<p class="lcg-rc-date">' + esc(ds) + '</p>'
    head = '<div class="lcg-rc-head">' + head + '<div class="lcg-rc-id">' + idblock + '</div>' + (c.showGoogleLogo ? googleG(18) : '') + '</div>'
    var stars = cw.showStars ? starsRow(r.rating, pal.star, 15) : ''
    var cl = clamp(r.text, cw.maxChars)
    var body = ''
    if (cl.t) {
      var readMore = cl.cut && cw.showReadMore
        ? '<button type="button" class="lcg-rc-more" data-full="' + esc(r.text || '') + '" data-less="' + esc(cl.t) + '" data-lang="' + esc(c.lang) + '">' + (c.lang === 'en' ? 'Read more' : 'Lire plus') + '</button>'
        : ''
      body = '<p class="lcg-rc-text">' + esc(cl.t) + '</p>' + readMore
    }
    return '<article class="lcg-rc">' + head + (stars ? '<div class="lcg-rc-stars">' + stars + '</div>' : '') + body + '</article>'
  }

  function header(payload, pal) {
    var c = payload.config.common
    if (!payload.config.carousel.showHeader) return ''
    var inner = (c.showGoogleLogo ? googleG(22) : '') + '<span class="lcg-hd-avg">' + num1(c.lang, payload.aggregate.average) + '</span>'
      + starsRow(payload.aggregate.average, pal.star, 16)
      + '<span class="lcg-hd-cnt">' + payload.aggregate.count + (c.lang === 'en' ? ' Google reviews' : ' avis Google') + '</span>'
    var h = '<div class="lcg-hd">' + inner + '</div>'
    if (payload.googleUrl) h = '<a class="lcg-link" href="' + esc(payload.googleUrl) + '" target="_blank" rel="noopener nofollow">' + h + '</a>'
    return h
  }

  function carouselHtml(payload, pal) {
    var cfg = payload.config, cw = cfg.carousel
    var list = cw.requireText
      ? payload.reviews.filter(function (r) { return r.text && String(r.text).trim() })
      : payload.reviews
    var cards = list.map(function (r) { return reviewCard(r, cfg, pal) }).join('')
    var body
    if (payload.style === 'grid') {
      body = '<div class="lcg-grid">' + cards + '</div>'
    } else if (payload.style === 'list') {
      body = '<div class="lcg-list">' + cards + '</div>'
    } else {
      var prevBtn = cw.showArrows ? '<button class="lcg-arw lcg-prev" aria-label="Précédent">&#8249;</button>' : ''
      var nextBtn = cw.showArrows ? '<button class="lcg-arw lcg-next" aria-label="Suivant">&#8250;</button>' : ''
      body = '<div class="lcg-sl">' + prevBtn + '<div class="lcg-vp"><div class="lcg-track">' + cards + '</div></div>' + nextBtn + '</div>'
      if (cw.showDots) body += '<div class="lcg-dots"></div>'
    }
    var content = '<div class="lcg-car">' + header(payload, pal) + body + '</div>'
    var radius = cw.cardRadius + 'px'
    var cpad = typeof cfg.common.containerPadding === 'number' ? cfg.common.containerPadding : 16
    var cardBg = (!cw.cardBackgroundColor || cw.cardBackgroundColor === 'auto') ? pal.bg : cw.cardBackgroundColor
    var css = '.lcg-car{background:' + pal.bg + ';border-radius:14px;padding:' + cpad + 'px}'
      + '.lcg-hd{display:flex;align-items:center;gap:10px;padding:6px 2px 14px}.lcg-hd-avg{font-size:22px;font-weight:500;color:' + pal.text + '}.lcg-hd-cnt{font-size:13px;color:' + pal.muted + ';margin-left:auto}'
      + '.lcg-rc{background:' + cardBg + ';border:1px solid ' + pal.border + ';border-radius:' + radius + ';padding:14px 16px;box-shadow:' + shadow(cw.cardShadow) + '}'
      + '.lcg-rc-head{display:flex;align-items:center;gap:10px}.lcg-rc-id{flex:1;min-width:0}.lcg-rc-name{margin:0;font-size:14px;font-weight:500;color:' + pal.text + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lcg-rc-date{margin:0;font-size:12px;color:' + pal.muted + '}'
      + '.lcg-rc-stars{margin:9px 0 7px}.lcg-rc-text{margin:0;font-size:13px;line-height:1.55;color:' + pal.muted + '}'
      + '.lcg-rc-more{display:block;margin:4px 0 0;padding:0;border:none;background:none;font:inherit;font-size:13px;font-weight:500;color:' + pal.accent + ';cursor:pointer;text-decoration:underline}'
      + '.lcg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:' + cw.gap + 'px}'
      + '.lcg-list .lcg-rc{border-left:0;border-right:0;border-top:0;border-radius:0;box-shadow:none;padding:15px 0}.lcg-list .lcg-rc:last-child{border-bottom:0}.lcg-list{padding:0 4px}'
      + '.lcg-sl{display:flex;align-items:center;gap:10px}.lcg-vp{flex:1;overflow:hidden}.lcg-track{display:flex;gap:' + cw.gap + 'px;transition:transform .35s ease}'
      + '.lcg-track>.lcg-rc{flex:0 0 auto}'
      + '.lcg-arw{flex:none;width:34px;height:34px;border-radius:50%;border:none;background:' + pal.accent + ';color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}'
      + '.lcg-dots{display:flex;justify-content:center;gap:6px;margin-top:12px}.lcg-dot{width:8px;height:8px;border-radius:50%;background:' + pal.border + ';border:none;padding:0;cursor:pointer}.lcg-dot.on{background:' + pal.accent + '}'
    return { css: css, html: content }
  }

  function initSlider(root, cfg) {
    var cw = cfg.carousel
    var vp = root.querySelector('.lcg-vp'), track = root.querySelector('.lcg-track')
    if (!vp || !track) return
    var cards = track.children, dotsBox = root.querySelector('.lcg-dots')
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    var idx = 0, timer = null
    function visible() { return window.innerWidth < 640 ? cw.cardsMobile : cw.cardsDesktop }
    function sizeCards() {
      var v = visible(), w = (vp.clientWidth - (v - 1) * cw.gap) / v
      for (var i = 0; i < cards.length; i++) cards[i].style.flexBasis = w + 'px'
      return w
    }
    function pages() { return Math.max(1, Math.ceil(cards.length / visible())) }
    function go(p) {
      var n = pages(); idx = (p + n) % n
      var w = cards.length ? cards[0].getBoundingClientRect().width : 0
      track.style.transform = 'translateX(' + (-(idx * visible()) * (w + cw.gap)) + 'px)'
      if (dotsBox) { var ds = dotsBox.children; for (var i = 0; i < ds.length; i++) ds[i].className = 'lcg-dot' + (i === idx ? ' on' : '') }
    }
    function buildDots() {
      if (!dotsBox) return
      dotsBox.innerHTML = ''
      for (var i = 0; i < pages(); i++) {
        var b = document.createElement('button'); b.className = 'lcg-dot' + (i === 0 ? ' on' : ''); b.setAttribute('aria-label', 'Page ' + (i + 1))
        ;(function (k) { b.addEventListener('click', function () { go(k); restart() }) })(i)
        dotsBox.appendChild(b)
      }
    }
    function restart() { if (timer) { clearInterval(timer); timer = null } start() }
    function start() {
      if (!cw.autoplay || reduce || pages() <= 1) return
      timer = setInterval(function () { go(idx + 1) }, cw.intervalMs)
    }
    var prev = root.querySelector('.lcg-prev'), next = root.querySelector('.lcg-next')
    if (prev) prev.addEventListener('click', function () { go(idx - 1); restart() })
    if (next) next.addEventListener('click', function () { go(idx + 1); restart() })
    if (cw.pauseOnHover) {
      root.addEventListener('mouseenter', function () { if (timer) { clearInterval(timer); timer = null } })
      root.addEventListener('mouseleave', function () { start() })
    }
    var rt
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { sizeCards(); buildDots(); go(0) }, 150) })
    sizeCards(); buildDots(); go(0); start()
  }

  function bindReadMore(root) {
    if (root.__lcgRmBound) return
    root.__lcgRmBound = true
    root.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.lcg-rc-more') : null
      if (!btn || !root.contains(btn)) return
      var textEl = btn.previousElementSibling
      if (!textEl || !textEl.classList || !textEl.classList.contains('lcg-rc-text')) return
      var expanded = btn.getAttribute('data-expanded') === '1'
      if (expanded) {
        textEl.textContent = btn.getAttribute('data-less')
        btn.textContent = btn.getAttribute('data-lang') === 'en' ? 'Read more' : 'Lire plus'
        btn.setAttribute('data-expanded', '0')
      } else {
        textEl.textContent = btn.getAttribute('data-full')
        btn.textContent = btn.getAttribute('data-lang') === 'en' ? 'Read less' : 'Lire moins'
        btn.setAttribute('data-expanded', '1')
      }
    })
  }

  function render(root, payload) {
    if (!root || !payload) return
    if (!payload.aggregate || payload.aggregate.count === 0 || !payload.reviews || !payload.reviews.length) {
      root.innerHTML = ''
      return
    }
    var cfg = payload.config
    var pal = resolve(cfg)
    loadFont(root, pal.fontKey)
    var pbHtml = cfg.common.showPoweredBy
      ? '<div class="lcg-pb"><a href="https://gmbmanager.ai" target="_blank" rel="noopener">Propulsé par GMB Manager</a></div>'
      : ''
    var part = payload.type === 'badge' ? badgeHtml(payload, pal, pbHtml) : carouselHtml(payload, pal)
    var outerPb = payload.type === 'badge' ? '' : pbHtml
    root.innerHTML = '<style>' + baseCss(pal, cfg) + part.css + '</style><div class="lcg-root">' + part.html + outerPb + '</div>'
    if (!root.__lcgAvBound) {
      root.__lcgAvBound = true
      root.addEventListener('error', function (e) {
        var t = e.target
        if (!t || !t.classList || !t.classList.contains('lcg-av-img')) return
        var span = document.createElement('span')
        span.className = 'lcg-av'
        span.style.background = t.getAttribute('data-c') || '#888'
        span.style.borderColor = t.style.borderColor
        span.textContent = t.getAttribute('data-fb') || ''
        t.replaceWith(span)
      }, true)
    }
    if (payload.type === 'carousel' && payload.style === 'slider') initSlider(root, cfg)
    if (payload.type === 'carousel') bindReadMore(root)
  }

  window.__lcgw = { render: render }
}

function LOCAGAIN_EMBED() {
  var cfg = window.__LCGW_CFG || {}
  var id = cfg.id, api = cfg.api
  if (!id || !api) return
  var mount = document.getElementById('gmbmanager.ai-widget-' + id) || document.getElementById('locagain-widget-' + id)
  if (!mount || mount.getAttribute('data-lcg-init')) return
  mount.setAttribute('data-lcg-init', '1')
  var root = mount.attachShadow ? mount.attachShadow({ mode: 'open' }) : mount

  function draw() {
    fetch(api + '/api/v1/widgets/' + id + '/public')
      .then(function (r) { return r.json() })
      .then(function (data) { if (window.__lcgw) window.__lcgw.render(root, data) })
      .catch(function () {})
  }
  if (window.__lcgw) { draw() }
  else {
    var s = document.createElement('script')
    s.src = api + '/api/v1/widgets/runtime.js'
    s.onload = draw
    document.head.appendChild(s)
  }
}

function runtimeSource() {
  return ';(' + LOCAGAIN_RUNTIME.toString() + ')();'
}

function embedSource(widgetId, apiBase) {
  return 'window.__LCGW_CFG=' + JSON.stringify({ id: widgetId, api: apiBase }) + ';'
    + ';(' + LOCAGAIN_EMBED.toString() + ')();'
}

module.exports = { runtimeSource, embedSource }
