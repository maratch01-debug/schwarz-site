/* SCHWARZ: хвост сайта. Классический скрипт без зависимостей, чтобы работать и в Vite (site-3d),
   и в статике с file:// (site-lite).
   window.SchwarzTail.mount(container, data, opts)
     data: { cars, palette, updated, ...content.json }
     opts: { theme: () => 'night'|'chrome'|'atelier', renders: 'renders/' (папка с <theme>/<id>-<view>.jpg) }
   Картинки карточек меняются при смене data-theme на <html> (MutationObserver). */
;(function () {
  'use strict'

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  var fmtPrice = function (n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'
  }
  var fmtKm = function (n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' км'
  }
  var fmtAcc = function (n) {
    return String(n).replace('.', ',')
  }
  var STATUS = { in_stock: 'В наличии', used: 'С пробегом', order: 'Под заказ' }
  var BODY_ORDER = ['Внедорожник', 'Седан', 'Купе', 'Универсал']

  function mount(container, data, opts) {
    opts = opts || {}
    var themeOf = opts.theme || function () { return document.documentElement.dataset.theme || 'night' }
    var rendersDir = (opts.renders || 'renders/').replace(/\/?$/, '/')
    var cars = data.cars || []
    var img = function (id, view) { return rendersDir + themeOf() + '/' + id + '-' + (view || '34f') + '.jpg' }
    var brands = []
    var bodies = []
    cars.forEach(function (c) {
      if (brands.indexOf(c.brand) < 0) brands.push(c.brand)
      if (bodies.indexOf(c.body) < 0) bodies.push(c.body)
    })
    bodies.sort(function (a, b) { return BODY_ORDER.indexOf(a) - BODY_ORDER.indexOf(b) })
    var brandGroups = ['Mercedes', 'BMW', 'Porsche', 'Audi'].filter(function (g) {
      return brands.some(function (b) { return b.indexOf(g) === 0 })
    })

    container.classList.add('tl')
    container.innerHTML =
      renderCatalog(cars, brandGroups, bodies, img, data) +
      renderServices(data) +
      renderAbout(data) +
      renderSteps(data) +
      renderFaq(data) +
      renderCta(data, cars) +
      renderFooter(data, cars) +
      renderDialog()

    mountFilters(container)
    mountCards(container, cars, img)
    mountSteps(container)
    mountFaq(container)
    mountForm(container, data)
    mountReveal(container)
    watchTheme(container, img)
    var api = { refresh: function () { swapImages(container, img) }, open: function (id) { if (container._dlgOpen) container._dlgOpen(id) } }
    window.SchwarzTail.last = api
    return api
  }

  /* ── разметка ── */
  function renderCatalog(cars, brandGroups, bodies, img, data) {
    var f = function (label, key, val, on) {
      return '<button type="button" data-f="' + key + '" data-v="' + esc(val) + '"' + (on ? ' class="is-on"' : '') + '>' + esc(label) + '</button>'
    }
    var filters = f('Все марки', 'brand', '', true) + brandGroups.map(function (b) { return f(b, 'brand', b) }).join('') +
      '<span class="tl-sep" aria-hidden="true"></span>' +
      f('Любой кузов', 'body', '', true) + bodies.map(function (b) { return f(b, 'body', b) }).join('')
    return '<section id="catalog" aria-labelledby="tl-cat-h"><div class="tl-wrap">' +
      '<div class="tl-head tl-io"><div><p class="tl-eyebrow">Каталог · ' + esc(data.city || 'Москва') + ' · обновлено ' + esc(data.updated || '') + '</p>' +
      '<h2 id="tl-cat-h">' + cars.length + ' машин. <em>Все тёмные.</em></h2></div>' +
      '<p class="tl-mono">Цена и наличие на дату обновления</p></div>' +
      '<div class="tl-filters tl-io" style="--d:.1s" role="group" aria-label="Фильтр каталога">' + filters + '</div>' +
      '<div class="tl-grid" style="margin-top:2rem">' + cars.map(function (c, i) { return renderCard(c, i, img) }).join('') +
      '<p class="tl-empty" hidden>По этому фильтру машин нет. Привезём под заказ за 6-8 недель.</p></div>' +
      '</div></section>'
  }
  function renderCard(c, i, img) {
    var meta = c.status === 'used' && c.mileage_km ? fmtKm(c.mileage_km) : c.status === 'in_stock' ? 'новая' : ''
    return '<button type="button" class="tl-card tl-glass tl-io" style="--d:' + (0.06 * (i % 6)).toFixed(2) + 's" data-id="' + esc(c.id) + '" data-brand="' + esc(c.brand) + '" data-body="' + esc(c.body) + '" aria-label="' + esc(c.brand + ' ' + c.model) + '">' +
      '<div class="tl-ph"><span class="tl-tag' + (c.status === 'in_stock' ? ' is-stock' : '') + '">' + esc(STATUS[c.status] || c.status) + '</span>' +
      '<img loading="lazy" decoding="async" src="' + esc(img(c.id)) + '" alt="' + esc(c.brand + ' ' + c.model + ', ' + c.color.name) + '" width="1920" height="1080"></div>' +
      '<div class="tl-body"><span class="tl-mono">' + esc(c.brand) + ' · ' + c.year + '</span>' +
      '<h3>' + esc(c.name) + '</h3>' +
      '<div class="tl-price">' + fmtPrice(c.price_rub) + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</div>' +
      '<span class="tl-mono"><i class="tl-chip" style="background:' + esc(c.color.hex) + '"></i>' + esc(c.color.name) + ' · ' + c.power_hp + ' л.с.</span>' +
      '</div></button>'
  }
  function renderServices(d) {
    return '<section id="services" class="tl-alt" aria-labelledby="tl-srv-h"><div class="tl-wrap">' +
      '<div class="tl-head tl-io"><div><p class="tl-eyebrow">Услуги</p><h2 id="tl-srv-h">Всё, что между <em>«хочу»</em> и ключами</h2></div></div>' +
      '<div class="tl-services">' + (d.services || []).map(function (s, i) {
        return '<article class="tl-service tl-glass tl-io" style="--d:' + (0.07 * i).toFixed(2) + 's"><span class="tl-meta">' + esc(s.meta) + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></article>'
      }).join('') + '</div></div></section>'
  }
  function renderAbout(d) {
    var a = d.about || {}
    return '<section id="about" aria-labelledby="tl-about-h"><div class="tl-wrap"><div class="tl-about">' +
      '<div class="tl-io"><p class="tl-eyebrow">' + esc(a.eyebrow || 'О салоне') + '</p><h2 id="tl-about-h">' + esc(a.title || '') + '</h2><p>' + esc(a.text || '') + '</p></div>' +
      '<div class="tl-facts tl-io" style="--d:.15s">' + (a.facts || []).map(function (f) {
        return '<div class="tl-fact"><b>' + esc(f.value) + '</b><span>' + esc(f.label) + '</span></div>'
      }).join('') + '</div></div></div></section>'
  }
  function renderSteps(d) {
    return '<section id="steps" class="tl-alt" aria-labelledby="tl-steps-h"><div class="tl-wrap">' +
      '<div class="tl-head tl-io"><div><p class="tl-eyebrow">Как купить</p><h2 id="tl-steps-h">От звонка до ключей: <em>четыре шага</em></h2></div></div>' +
      '<div class="tl-steps" data-steps>' + (d.steps || []).map(function (s, i) {
        return '<div class="tl-step tl-io" style="--d:' + (0.08 * i).toFixed(2) + 's"><span class="tl-n">' + esc(s.n) + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></div>'
      }).join('') + '</div></div></section>'
  }
  function renderFaq(d) {
    return '<section id="faq" aria-labelledby="tl-faq-h"><div class="tl-wrap">' +
      '<div class="tl-head tl-io"><div><p class="tl-eyebrow">Вопросы</p><h2 id="tl-faq-h">Что спрашивают <em>до визита</em></h2></div></div>' +
      '<div class="tl-faq tl-io" style="--d:.1s">' + (d.faq || []).map(function (q) {
        return '<details><summary>' + esc(q.q) + '</summary><div class="tl-a">' + esc(q.a) + '</div></details>'
      }).join('') + '</div></div></section>'
  }
  function renderCta(d, cars) {
    var c = d.cta || {}
    var k = d.contacts || {}
    var options = '<option value="">Любая, подберёте на месте</option>' + cars.map(function (x) {
      return '<option value="' + esc(x.id) + '">' + esc(x.brand + ' ' + x.name) + '</option>'
    }).join('')
    return '<section id="cta" class="tl-alt" aria-labelledby="tl-cta-h"><div class="tl-wrap"><div class="tl-cta">' +
      '<div class="tl-io"><p class="tl-eyebrow">Запись на просмотр</p><h2 id="tl-cta-h">' + esc(c.title || '') + '</h2><p class="tl-lede">' + esc(c.text || '') + '</p>' +
      '<div class="tl-contacts"><span>' + esc(k.address || '') + '</span><span>' + esc(k.hours || '') + '</span>' +
      '<span><a href="tel:' + esc(String(k.phone || '').replace(/\s/g, '')) + '">' + esc(k.phone || '') + '</a> · <a href="https://t.me/' + esc(String(k.telegram || '').replace('@', '')) + '" rel="noopener">' + esc(k.telegram || '') + '</a></span></div></div>' +
      '<form class="tl-form tl-glass tl-io" style="--d:.12s" novalidate data-form>' +
      '<div class="tl-fields" style="display:grid;gap:14px">' +
      '<div class="tl-row"><label>Имя<input name="name" autocomplete="name" placeholder="Как к вам обращаться" required aria-required="true"></label>' +
      '<label>Телефон<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7" required aria-required="true"></label></div>' +
      '<label>Машина<select name="car" data-car-select>' + options + '</select></label>' +
      '<label>Когда удобно<select name="slot"><option>Сегодня</option><option>Завтра</option><option>На этой неделе</option><option>На выходных</option></select></label>' +
      '<label class="tl-consent"><input type="checkbox" name="consent" required aria-required="true"><span>Это демонстрационный сайт: форма ничего не отправляет, данные не сохраняются.</span></label>' +
      '<button type="submit" class="tl-btn">' + esc(c.button || 'Записаться') + '</button>' +
      '<div class="tl-status" role="status" aria-live="polite"></div></div>' +
      '<div class="tl-done"><p class="tl-eyebrow">' + esc(c.success_title || 'Готово') + '</p><h3 data-done-title></h3><p style="margin:0;color:var(--ink-dim)">' + esc(c.success_text || '') + '</p><button type="button" class="tl-btn tl-ghost" data-reset>Записать ещё раз</button></div>' +
      '</form></div></div></section>'
  }
  function renderFooter(d, cars) {
    var f = d.footer || {}
    var k = d.contacts || {}
    var credits = cars.filter(function (c) { return c.credit }).map(function (c) {
      return '<p>' + esc(c.brand + ' ' + c.name) + ': «<a href="' + esc(c.credit.url) + '" rel="noopener">' + esc(c.credit.title) + '</a>», автор ' + esc(c.credit.author) + ', ' + esc(c.credit.license) + '</p>'
    }).join('')
    return '<footer><div class="tl-wrap"><div class="tl-foot">' +
      '<div><div class="tl-logo">Schwarz<i></i></div><p style="margin:.6rem 0 0">' + esc((d.brand || {}).claim || '') + '</p></div>' +
      '<div><p style="margin:0">' + esc(k.address || '') + '<br>' + esc(k.hours || '') + '<br>' + esc(k.email || '') + '</p></div></div>' +
      '<div class="tl-credits"><p style="color:var(--ink-dim)">' + esc(f.credits_title || '3D-модели') + '. ' + esc(f.credits_note || '') + '</p>' + credits + '</div>' +
      '<p class="tl-disclaimer">' + esc(f.disclaimer || '') + '</p>' +
      '</div></footer>'
  }
  function renderDialog() {
    return '<dialog class="tl-dialog" data-dialog aria-label="Карточка машины"><div class="tl-panel tl-glass">' +
      '<button type="button" class="tl-close" data-close aria-label="Закрыть">×</button>' +
      '<div class="tl-media"><img alt="" data-dlg-img><div class="tl-views" role="group" aria-label="Ракурс">' +
      '<button type="button" data-view="34f" class="is-on">¾</button><button type="button" data-view="side">Бок</button><button type="button" data-view="34r">Корма</button></div></div>' +
      '<div class="tl-info" data-dlg-info></div></div></dialog>'
  }

  /* ── поведение ── */
  function mountFilters(root) {
    var state = { brand: '', body: '' }
    var cards = root.querySelectorAll('.tl-card')
    var empty = root.querySelector('.tl-empty')
    var apply = function () {
      var n = 0
      cards.forEach(function (c) {
        var ok = (!state.brand || c.dataset.brand.indexOf(state.brand) === 0) && (!state.body || c.dataset.body === state.body)
        c.classList.toggle('is-hidden', !ok)
        if (ok) n++
      })
      if (empty) empty.hidden = n > 0
    }
    root.querySelectorAll('.tl-filters button').forEach(function (b) {
      b.addEventListener('click', function () {
        state[b.dataset.f] = b.dataset.v
        root.querySelectorAll('.tl-filters button[data-f="' + b.dataset.f + '"]').forEach(function (x) { x.classList.toggle('is-on', x === b) })
        apply()
      })
    })
  }

  function mountCards(root, cars, img) {
    var dlg = root.querySelector('[data-dialog]')
    var dImg = dlg.querySelector('[data-dlg-img]')
    var dInfo = dlg.querySelector('[data-dlg-info]')
    var current = null
    var view = '34f'
    var show = function (id) {
      var c = cars.filter(function (x) { return x.id === id })[0]
      if (!c) return
      current = c
      view = '34f'
      dlg.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.view === view) })
      dImg.src = img(c.id, view)
      dImg.alt = c.brand + ' ' + c.model + ', ' + c.color.name
      var meta = c.status === 'used' && c.mileage_km ? fmtKm(c.mileage_km) : STATUS[c.status]
      dInfo.innerHTML =
        '<div><span class="tl-mono">' + esc(c.brand) + ' · ' + c.year + ' · ' + esc(c.body) + '</span><h3 class="tl-display" style="font-size:var(--h2);margin:.4rem 0 .6rem">' + esc(c.name) + '</h3>' +
        '<p style="margin:0;color:var(--ink-dim)">' + esc(c.tagline) + '</p></div>' +
        '<div class="tl-price" style="font-size:2rem">' + fmtPrice(c.price_rub) + '<small>' + esc(meta || '') + '</small></div>' +
        '<div class="tl-specs"><div><b>' + c.power_hp + '</b><span>л.с.</span></div><div><b>' + fmtAcc(c.accel_0_100) + '</b><span>0-100, с</span></div><div><b>' + c.torque_nm + '</b><span>Нм</span></div><div><b>' + c.top_speed + '</b><span>км/ч</span></div></div>' +
        '<dl class="tl-kv"><dt>Двигатель</dt><dd>' + esc(c.engine) + '</dd><dt>Привод</dt><dd>' + esc(c.drive) + '</dd>' +
        '<dt>Цвет</dt><dd><i class="tl-chip" style="background:' + esc(c.color.hex) + '"></i>' + esc(c.color.name) + ', ' + esc({ metallic: 'металлик', gloss: 'глянец', matte: 'матовый' }[c.color.finish] || c.color.finish) + '</dd>' +
        '<dt>Статус</dt><dd>' + esc(STATUS[c.status] || c.status) + (c.price_note ? '. ' + esc(c.price_note) : '') + '</dd></dl>' +
        '<div><a href="#cta" class="tl-btn" data-book="' + esc(c.id) + '">Записаться на просмотр</a></div>' +
        '<p class="tl-sources">Цена на ' + esc((c.sources[0] || {}).date || '') + ': ' + c.sources.map(function (s) { return '<a href="' + esc(s.url) + '" rel="noopener">' + esc(s.name) + '</a>' }).join(' · ') + '</p>' +
        (c.credit ? '<p class="tl-credit">3D-модель: «<a href="' + esc(c.credit.url) + '" rel="noopener">' + esc(c.credit.title) + '</a>», ' + esc(c.credit.author) + ', ' + esc(c.credit.license) + '</p>' : '')
      if (typeof dlg.showModal === 'function') dlg.showModal()
      else dlg.setAttribute('open', '')
      dInfo.scrollTop = 0
      dlg.querySelector('[data-close]').focus()
    }
    root.querySelectorAll('.tl-card').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.id) }) })
    dlg.querySelector('[data-close]').addEventListener('click', function () { dlg.close() })
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close() })
    dlg.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        view = b.dataset.view
        dlg.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('is-on', x === b) })
        if (current) dImg.src = img(current.id, view)
      })
    })
    dInfo.addEventListener('click', function (e) {
      var a = e.target.closest('[data-book]')
      if (!a) return
      e.preventDefault()
      dlg.close()
      var sel = root.querySelector('[data-car-select]')
      if (sel) sel.value = a.dataset.book
      var cta = root.querySelector('#cta')
      if (cta) cta.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    root._dlgRefresh = function () { if (current && dlg.open) dImg.src = img(current.id, view) }
    root._dlgOpen = show
  }

  function mountSteps(root) {
    var list = root.querySelector('[data-steps]')
    if (!list) return
    var steps = list.querySelectorAll('.tl-step')
    var i = -1, timer = 0
    var paint = function () { steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i) }) }
    var tick = function () { i = i >= steps.length ? 0 : i + 1; paint() }
    if (!('IntersectionObserver' in window)) { i = 0; paint(); return }
    new IntersectionObserver(function (en) {
      var vis = en.some(function (e) { return e.isIntersecting })
      clearInterval(timer)
      if (!vis) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { i = 0; paint(); return }
      tick()
      timer = setInterval(tick, 1300)
    }, { threshold: 0.4 }).observe(list)
  }

  function mountFaq(root) {
    var all = root.querySelectorAll('.tl-faq details')
    all.forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) all.forEach(function (o) { if (o !== d) o.open = false }) })
    })
  }

  function mountForm(root, data) {
    var form = root.querySelector('[data-form]')
    if (!form) return
    var status = form.querySelector('.tl-status')
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var name = form.elements.name, phone = form.elements.phone, consent = form.elements.consent
      var bad = []
      ;[name, phone].forEach(function (f) { f.setAttribute('aria-invalid', 'false') })
      if (!name.value.trim()) bad.push(name)
      if (!/^\+?[\d\s()-]{10,}$/.test(phone.value.trim())) bad.push(phone)
      if (bad.length || !consent.checked) {
        bad.forEach(function (f) { f.setAttribute('aria-invalid', 'true') })
        status.textContent = bad.length ? 'Проверьте имя и телефон.' : 'Отметьте, что вы поняли: это демо.'
        ;(bad[0] || consent).focus()
        return
      }
      var sel = form.elements.car
      var carName = sel.options[sel.selectedIndex].text
      form.querySelector('[data-done-title]').textContent = name.value.trim() + ', ' + (sel.value ? carName : 'подберём на месте') + ', ' + form.elements.slot.value.toLowerCase()
      form.classList.add('is-done')
      form.querySelector('[data-reset]').focus()
    })
    form.querySelector('[data-reset]').addEventListener('click', function () {
      form.reset()
      form.classList.remove('is-done')
      status.textContent = ''
      form.elements.name.focus()
    })
  }

  function mountReveal(root) {
    var items = root.querySelectorAll('.tl-io')
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(function (el) { el.classList.add('is-in') })
      return
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) } })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    items.forEach(function (el) { io.observe(el) })
  }

  function swapImages(root, img) {
    root.querySelectorAll('.tl-card').forEach(function (c) {
      var im = c.querySelector('img')
      var next = img(c.dataset.id)
      if (im.getAttribute('src') !== next) im.src = next
    })
    if (root._dlgRefresh) root._dlgRefresh()
  }
  function watchTheme(root, img) {
    if (!('MutationObserver' in window)) return
    new MutationObserver(function () { swapImages(root, img) }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }

  window.SchwarzTail = { mount: mount, formatPrice: fmtPrice }
})()
