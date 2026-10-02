/* SCHWARZ v2 · оболочка сайта аренды: темы, шапка, меню, hero с выбором машины, панель дат, факты.
   Секции ниже монтирует tail.js. Данные: window.SCHWARZ_CARS, window.SCHWARZ_CONTENT. */
;(function () {
  'use strict'
  var root = document.documentElement
  var cars = window.SCHWARZ_CARS || { cars: [] }
  var content = window.SCHWARZ_CONTENT || {}
  var data = Object.assign({}, cars, content)
  var T = window.SchwarzTail
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var $ = function (s, el) { return (el || document).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)) }
  var list = (cars.cars || []).filter(function (c) { return c.rent })

  /* ── тема ── */
  function setTheme(t, save) {
    root.dataset.theme = t
    if (save) try { localStorage.setItem('schwarz-theme', t) } catch (e) {}
    $$('[data-theme-btn]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.themeBtn === t) })
    var meta = $('meta[name="theme-color"]')
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b0b0d'
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-btn]')
    if (b) setTheme(b.dataset.themeBtn, true)
  })

  /* ── тексты ── */
  if (data.brand) {
    if (data.brand.eyebrow) $('[data-hero-eyebrow]').textContent = data.brand.eyebrow
    if (data.brand.lede) $('[data-hero-lede]').textContent = data.brand.lede
  }
  var facts = $('[data-facts]')
  if (facts && data.facts) {
    facts.innerHTML = data.facts.map(function (f, i) {
      return '<li class="reveal" style="--d:' + (0.5 + i * 0.07).toFixed(2) + 's"><b>' + esc(f.value) + '<small>' + esc(f.unit) + '</small></b><span>' + esc(f.label) + '</span></li>'
    }).join('')
  }

  /* ── hero: машины на обложке ── */
  var heroes = list.filter(function (c) { return c.hero }).sort(function (a, b) { return (a.hero_order || 99) - (b.hero_order || 99) })
  if (!heroes.length) heroes = list.slice(0, 5)
  var imgs = $('[data-hero-imgs]')
  var pick = $('[data-hero-pick]')
  var capName = $('[data-hero-name]')
  var capPrice = $('[data-hero-price]')
  var hi = -1
  var timer = 0
  imgs.innerHTML = heroes.map(function (c, i) {
    return '<img src="' + esc(c.photos.cutout) + '" alt="' + esc(c.brand + ' ' + c.name + ', ' + c.color.name) + '"' + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async" width="1800" height="900">'
  }).join('')
  pick.innerHTML = heroes.map(function (c, i) {
    return '<button type="button" role="tab" aria-selected="false" data-hero="' + i + '">' + esc(c.name) + '</button>'
  }).join('')
  function showHero(i, user) {
    if (i === hi) return
    $$('img', imgs).forEach(function (im, k) {
      im.classList.remove('is-out')
      if (k === hi) im.classList.add('is-out')
      im.classList.toggle('is-on', k === i)
    })
    $$('[data-hero]', pick).forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)) })
    var c = heroes[i]
    capName.textContent = c.brand + ' ' + c.name
    capPrice.innerHTML = 'от <b>' + T.money(c.rent.day) + '</b> в сутки · ' + esc(c.power_hp) + ' л.с.'
    hi = i
    if (user) { clearInterval(timer); timer = 0 }
  }
  pick.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hero]')
    if (b) showHero(+b.dataset.hero, true)
  })
  showHero(0)
  if (!reduced && heroes.length > 1) {
    timer = setInterval(function () { if (!document.hidden) showHero((hi + 1) % heroes.length) }, 5200)
  }

  /* ── панель дат в hero ── */
  var booker = $('[data-booker]')
  var bkCar = $('[data-bk-car]')
  var bkFrom = $('[data-bk-from]')
  var bkTo = $('[data-bk-to]')
  var bkPlace = $('[data-bk-place]')
  var bkNote = $('[data-bk-note]')
  var bkCta = $('[data-bk-cta]')
  bkCar.innerHTML = '<option value="">Любой из парка</option>' + list.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.brand + ' ' + c.name) + '</option>' }).join('')
  bkPlace.innerHTML = (cars.locations || []).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>' }).join('')
  var now = new Date()
  var d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  var d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4)
  bkFrom.value = T.iso(d1)
  bkTo.value = T.iso(d2)
  bkFrom.min = T.iso(now)
  bkTo.min = T.iso(d1)

  function bookerState() {
    return { car: bkCar.value, from: bkFrom.value, fromTime: booker.elements.fromTime.value, to: bkTo.value, toTime: booker.elements.toTime.value, place: bkPlace.value }
  }
  function note() {
    var st = bookerState()
    var c = list.filter(function (x) { return x.id === st.car })[0]
    var q = T.quote(c || list[0], st, cars.locations)
    bkNote.classList.toggle('is-error', !!(q && q.error))
    if (!q) { bkNote.textContent = ''; return }
    if (q.error) { bkNote.textContent = q.error; return }
    bkNote.innerHTML = 'с ' + esc(T.human(st.from)) + ' по ' + esc(T.human(st.to)) + ' · <b>' + esc(T.days(q.days)) + '</b>' +
      (c ? ' · ' + esc(c.name) + ' за <b>' + T.money(q.total) + '</b>' : ' · цены в автопарке пересчитаются под эти даты') +
      (q.fee ? ' · подача ' + T.money(q.fee) : '')
    bkCta.textContent = c ? 'К бронированию' : 'Показать цены'
  }
  booker.addEventListener('input', note)
  booker.addEventListener('change', function () {
    if (bkTo.value && bkFrom.value && bkTo.value < bkFrom.value) bkTo.value = bkFrom.value
    bkTo.min = bkFrom.value
    note()
    window.dispatchEvent(new CustomEvent('schwarz:booking', { detail: bookerState() }))
  })
  booker.addEventListener('submit', function (e) {
    e.preventDefault()
    var st = bookerState()
    window.dispatchEvent(new CustomEvent('schwarz:booking', { detail: st }))
    var q = T.quote(list[0], st, cars.locations)
    if (q && q.error) { bkTo.focus(); return }
    if (st.car && tail) tail.book(st.car)
    else { var f = document.getElementById('fleet'); if (f) f.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }) }
  })
  window.addEventListener('schwarz:booking-changed', function (e) {
    var s = e.detail
    if (s.car !== undefined) bkCar.value = s.car
    if (s.from) bkFrom.value = s.from
    if (s.to) bkTo.value = s.to
    if (s.fromTime) booker.elements.fromTime.value = s.fromTime
    if (s.toTime) booker.elements.toTime.value = s.toTime
    if (s.place) bkPlace.value = s.place
    note()
  })
  window.addEventListener('schwarz:edit-dates', function () {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    setTimeout(function () { bkFrom.focus({ preventScroll: true }) }, reduced ? 0 : 650)
  })

  /* ── секции ── */
  var tail = null
  if (T && $('#tail')) tail = T.mount($('#tail'), data, { assets: '' })
  window.dispatchEvent(new CustomEvent('schwarz:booking', { detail: bookerState() }))
  note()

  /* ── шапка: прячется при скролле вниз, активный пункт ── */
  var nav = $('[data-nav]')
  var menuOpen = false
  var lastY = window.scrollY
  var ticking = false
  window.addEventListener('scroll', function () {
    if (ticking) return
    ticking = true
    requestAnimationFrame(function () {
      var y = window.scrollY
      if (!menuOpen) nav.classList.toggle('is-hidden', y > 160 && y > lastY + 2)
      if (y < lastY - 2) nav.classList.remove('is-hidden')
      lastY = y
      ticking = false
    })
  }, { passive: true })
  if ('IntersectionObserver' in window) {
    var links = $$('.nav-links a')
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (!x.isIntersecting) return
        links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + x.target.id) })
      })
    }, { rootMargin: '-45% 0px -50% 0px' })
    ;['fleet', 'how', 'terms', 'services', 'faq'].forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el) })
  }

  /* ── меню на телефоне ── */
  var burger = $('[data-burger]')
  var menu = $('[data-menu]')
  function setMenu(open) {
    menuOpen = open
    burger.setAttribute('aria-expanded', String(open))
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню')
    root.style.overflow = open ? 'hidden' : ''
    if (open) {
      menu.hidden = false
      nav.classList.remove('is-hidden')
      requestAnimationFrame(function () { menu.classList.add('is-open') })
    } else {
      menu.classList.remove('is-open')
      setTimeout(function () { if (!menuOpen) menu.hidden = true }, reduced ? 0 : 500)
    }
  }
  burger.addEventListener('click', function () { setMenu(!menuOpen) })
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false) })
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus() } })

  setTheme(root.dataset.theme || 'night', false)
  document.body.dataset.ready = '1'
})()
