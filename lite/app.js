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
  var capNums = $('[data-hero-nums]')
  var model = $('[data-hero-model]')
  var scene = $('[data-hero-scene]')
  var hi = -1
  var timer = 0
  var AUTO = 5200
  // машина на сцене: вырезка, блик по кузову (маска = сама вырезка), отражение на полу;
  // --ar из реального размера, чтобы машина и отражение легли под колёса
  imgs.innerHTML = heroes.map(function (c, i) {
    var src = esc(c.photos.cutout)
    return '<div class="car-shot" data-shot>' +
      '<img class="car-img" src="' + src + '" alt="' + esc(c.brand + ' ' + c.name + ', ' + c.color.name) + '"' + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">' +
      '<span class="car-sheen" aria-hidden="true"></span>' +
      '<img class="car-refl" src="' + src + '" alt="" aria-hidden="true" loading="lazy" decoding="async">' +
      '</div>'
  }).join('')
  $$('[data-shot]', imgs).forEach(function (shot, k) {
    var im = $('.car-img', shot)
    var sheen = $('.car-sheen', shot)
    // маска грузится в CORS-режиме: при открытии файлом (file://) браузер её блокирует, блик тогда не нужен
    if (/^https?:$/.test(location.protocol)) {
      var url = 'url("' + heroes[k].photos.cutout + '")'
      sheen.style.webkitMaskImage = url
      sheen.style.maskImage = url
    } else sheen.remove()
    function ar() { if (im.naturalWidth) shot.style.setProperty('--ar', (im.naturalWidth / im.naturalHeight).toFixed(4)) }
    if (im.complete) ar(); else im.addEventListener('load', ar)
  })
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n }
  var heroTotal = $('[data-hero-total]')
  var heroNum = $('[data-hero-num]')
  if (heroTotal) heroTotal.textContent = pad2(heroes.length)
  pick.innerHTML = heroes.map(function (c, i) {
    return '<button type="button" role="tab" aria-selected="false" data-hero="' + i + '"><i>' + pad2(i + 1) + '</i>' + esc(c.name) + '</button>'
  }).join('')

  // огромное имя модели за машиной: «GT 63 Coupé» → «GT 63», «911 Carrera S» → «911», «M5» → «M5»
  function badge(name) {
    var t = String(name).split(' ')
    return t[1] && /^\d/.test(t[1]) ? t[0] + ' ' + t[1] : t[0]
  }
  function setModel(text) {
    var old = $$('.mw', model)
    old.forEach(function (w) {
      w.classList.add('is-out')
      setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w) }, reduced ? 0 : 1100)
    })
    var w = document.createElement('span')
    w.className = 'mw'
    w.innerHTML = text.split('').map(function (ch, k) {
      return ch === ' ' ? '<i class="sp"></i>' : '<b style="--k:' + k + '"><span>' + esc(ch) + '</span></b>'
    }).join('')
    model.appendChild(w)
  }
  var fmt = function (v) { return esc(String(v).replace('.', ',')) }

  function showHero(i, user) {
    if (i === hi) return
    $$('[data-shot]', imgs).forEach(function (im, k) {
      im.classList.remove('is-out')
      if (k === hi) im.classList.add('is-out')
      im.classList.toggle('is-on', k === i)
    })
    $$('[data-hero]', pick).forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)) })
    var c = heroes[i]
    setModel(badge(c.name))
    capName.innerHTML = esc(c.brand) + ' ' + esc(c.name) + ' <span>· ' + esc(c.color.name) + '</span>'
    capNums.innerHTML =
      '<div><dt>Мощность</dt><dd>' + fmt(c.power_hp) + '<small>л.с.</small></dd></div>' +
      '<div><dt>0-100 км/ч</dt><dd>' + fmt(c.accel_0_100) + '<small>с</small></dd></div>' +
      '<div class="is-price"><dt>Сутки от</dt><dd>' + T.money(c.rent.day).replace(/\s?₽/, '') + '<small>₽</small></dd></div>'
    if (heroNum) heroNum.textContent = pad2(i + 1)
    hi = i
    if (user) { clearInterval(timer); timer = 0; pick.classList.remove('is-auto') }
  }
  pick.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hero]')
    if (b) showHero(+b.dataset.hero, true)
  })
  showHero(0)
  if (!reduced && heroes.length > 1) {
    pick.classList.add('is-auto')
    timer = setInterval(function () { if (!document.hidden) showHero((hi + 1) % heroes.length) }, AUTO)
  }

  // глубина: буквы и машина чуть расходятся за курсором (только мышь, без reduced-motion)
  if (!reduced && scene && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var tx = 0, ty = 0, px = 0, py = 0, raf = 0
    var tick = function () {
      px += (tx - px) * 0.06
      py += (ty - py) * 0.06
      scene.style.setProperty('--px', px.toFixed(4))
      scene.style.setProperty('--py', py.toFixed(4))
      raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.001 ? requestAnimationFrame(tick) : 0
    }
    $('.hero').addEventListener('pointermove', function (e) {
      tx = e.clientX / window.innerWidth * 2 - 1
      ty = e.clientY / window.innerHeight * 2 - 1
      if (!raf) raf = requestAnimationFrame(tick)
    })
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
    booker.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
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
      nav.classList.toggle('is-scrolled', y > 24)
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
