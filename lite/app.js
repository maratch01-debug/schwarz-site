/* SCHWARZ lite. Данные: window.SCHWARZ_CARS (cars.json), window.SCHWARZ_CONTENT (content.json). */
;(function () {
  'use strict'
  var cars = window.SCHWARZ_CARS || { cars: [], palette: [] }
  var content = window.SCHWARZ_CONTENT || {}
  var data = Object.assign({}, cars, content)
  var root = document.documentElement
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var theme = function () { return root.dataset.theme || 'night' }
  var render = function (name, view) { return 'renders/' + theme() + '/' + name + '-' + (view || '34f') + '.jpg' }
  var fmtPrice = window.SchwarzTail ? window.SchwarzTail.formatPrice : function (n) { return n + ' ₽' }

  /* тема */
  var setTheme = function (t, save) {
    root.dataset.theme = t
    if (save) try { localStorage.setItem('schwarz-theme', t) } catch (e) {}
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.themeBtn === t) })
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0a0d18'
    swapRenders()
  }
  document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.dataset.themeBtn, true) }) })

  /* тексты из данных */
  document.querySelectorAll('[data-text]').forEach(function (el) {
    var v = el.dataset.text.split('.').reduce(function (o, k) { return o && o[k] }, data)
    if (v) el.textContent = v
  })
  var cc = document.querySelector('[data-count-cars]')
  if (cc) cc.textContent = cars.cars.length
  var facts = document.querySelector('[data-facts]')
  if (facts && data.about) facts.innerHTML = data.about.facts.map(function (f) { return '<li><b>' + esc(f.value) + '</b><span>' + esc(f.label) + '</span></li>' }).join('')

  /* пять героев */
  var heroes = cars.cars.filter(function (c) { return c.hero }).sort(function (a, b) { return (a.hero_order || 99) - (b.hero_order || 99) })
  var hostH = document.querySelector('[data-heroes]')
  if (hostH) {
    hostH.innerHTML = heroes.map(function (c, i) {
      var view = i % 2 ? 'side' : '34f'
      var meta = c.status === 'used' && c.mileage_km ? String(c.mileage_km).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' км' : c.status === 'in_stock' ? 'новая' : ''
      return '<article class="car io" id="car-' + esc(c.id) + '" aria-labelledby="car-h-' + esc(c.id) + '">' +
        '<div class="car-media"><img loading="' + (i === 0 ? 'eager' : 'lazy') + '" decoding="async" data-render="' + esc(c.id) + '" data-rview="' + view + '" alt="' + esc(c.brand + ' ' + c.model + ', ' + c.color.name) + '" width="1920" height="1080"><span class="car-no">0' + (i + 1) + ' / 0' + heroes.length + '</span></div>' +
        '<div class="car-info"><p class="eyebrow">' + esc(c.brand) + ' · ' + c.year + ' · ' + esc(c.body) + '</p>' +
        '<h2 id="car-h-' + esc(c.id) + '">' + esc(c.name) + '</h2><p class="tag">' + esc(c.tagline) + '</p>' +
        '<div class="car-specs"><div><b>' + c.power_hp + '</b><span>л.с.</span></div><div><b>' + String(c.accel_0_100).replace('.', ',') + '</b><span>0-100, с</span></div><div><b>' + c.torque_nm + '</b><span>Нм</span></div><div><b>' + c.top_speed + '</b><span>км/ч</span></div></div>' +
        '<div class="car-price"><b>' + fmtPrice(c.price_rub) + '</b><span class="tl-mono">' + esc(meta) + '</span><span class="tl-mono"><i class="tl-chip" style="background:' + esc(c.color.hex) + '"></i>' + esc(c.color.name) + '</span></div>' +
        '<div class="car-actions"><button type="button" class="tl-btn" data-open="' + esc(c.id) + '">Подробнее</button><a class="tl-btn tl-ghost" href="#cta" data-book="' + esc(c.id) + '">Записаться на просмотр</a></div>' +
        '</div></article>'
    }).join('')
  }

  /* цвет */
  var palette = cars.palette || []
  var chips = document.querySelector('[data-chips]')
  var pImg = document.querySelector('[data-paint-img]')
  var pNext = document.querySelector('[data-paint-img-next]')
  var pName = document.querySelector('[data-paint-name]')
  var pMedia = document.querySelector('.paint-media')
  var currentPaint = palette[0] ? palette[0].id : 'obsidian'
  var paintSrc = function (id) { return 'renders/' + theme() + '/g900-color-' + id + '.jpg' }
  var setPaint = function (id, animate) {
    currentPaint = id
    var p = palette.filter(function (x) { return x.id === id })[0]
    if (chips) chips.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-on', b.dataset.paint === id) })
    if (pName && p) pName.textContent = p.name + ' · ' + ({ metallic: 'металлик', gloss: 'глянец', matte: 'матовый' }[p.finish] || p.finish)
    if (!pImg) return
    if (!animate || reduced) { pImg.src = paintSrc(id); return }
    pNext.src = paintSrc(id)
    var done = function () {
      pMedia.classList.add('is-fading')
      setTimeout(function () { pImg.src = pNext.src; pMedia.classList.remove('is-fading') }, 900)
    }
    if (pNext.complete) done()
    else pNext.onload = done
  }
  if (chips) {
    chips.innerHTML = palette.map(function (p) { return '<button type="button" data-paint="' + esc(p.id) + '" style="background:' + esc(p.hex) + '" aria-label="' + esc(p.name) + '" title="' + esc(p.name) + '"></button>' }).join('')
    chips.addEventListener('click', function (e) { var b = e.target.closest('[data-paint]'); if (b) setPaint(b.dataset.paint, true) })
    setPaint(currentPaint, false)
  }

  /* картинки по теме */
  function swapRenders() {
    document.querySelectorAll('img[data-render]').forEach(function (im) {
      var next = render(im.dataset.render, im.dataset.rview)
      if (im.getAttribute('src') !== next) im.src = next
    })
    if (pImg) pImg.src = paintSrc(currentPaint)
  }
  swapRenders()

  /* хвост */
  var tailHost = document.getElementById('tail')
  var tail = null
  if (tailHost && window.SchwarzTail) tail = window.SchwarzTail.mount(tailHost, data, { theme: theme, renders: 'renders/' })
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]')
    if (o && tail) { tail.open(o.dataset.open); return }
    var b = e.target.closest('[data-book]')
    if (b) { var sel = document.querySelector('[data-car-select]'); if (sel) sel.value = b.dataset.book }
  })

  /* шапка: прячется при скролле вниз, активный пункт меню */
  var hd = document.querySelector('[data-header]')
  var lastY = 0
  var nav = document.querySelector('[data-nav]')
  var burger = document.querySelector('[data-burger]')
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open')
      burger.setAttribute('aria-expanded', String(open))
      document.body.style.overflow = open ? 'hidden' : ''
    })
    nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '' }) })
  }
  var ticking = false
  window.addEventListener('scroll', function () {
    if (ticking) return
    ticking = true
    requestAnimationFrame(function () {
      var y = window.scrollY
      if (hd && !(nav && nav.classList.contains('is-open'))) hd.classList.toggle('is-hidden', y > 120 && y > lastY)
      lastY = y
      var par = document.querySelector('[data-parallax] img')
      if (par && !reduced && y < innerHeight * 1.2) par.style.transform = 'translate3d(0,' + (y * 0.22).toFixed(1) + 'px,0) scale(1.04)'
      ticking = false
    })
  }, { passive: true })
  var sections = ['heroes', 'catalog', 'services', 'about', 'cta'].map(function (id) { return document.getElementById(id) }).filter(Boolean)
  if ('IntersectionObserver' in window && nav) {
    new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return
        nav.querySelectorAll('a').forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id) })
      })
    }, { rootMargin: '-40% 0px -55% 0px' }).observe && sections.forEach(function (s) {
      new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) nav.querySelectorAll('a').forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + s.id) }) }) }, { rootMargin: '-40% 0px -55% 0px' }).observe(s)
    })
  }

  /* появление */
  var ios = document.querySelectorAll('.io')
  if (!('IntersectionObserver' in window) || reduced) ios.forEach(function (el) { el.classList.add('is-in') })
  else {
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) } }) }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    ios.forEach(function (el) { io.observe(el) })
  }

  setTheme(theme(), false)
  document.body.dataset.ready = '1'
})()
