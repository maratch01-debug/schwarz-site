/* SCHWARZ v2 · секции сайта аренды. Классический скрипт без зависимостей: работает в Vite (site-3d)
   и в статике с file:// (site-lite).
   window.SchwarzTail.mount(container, data, opts) → { setBooking(partial), open(id), refresh() }
     data: cars.json + content.json (cars, locations, palette, fleet, steps, terms, services, faq, booking, contacts, footer)
     opts: { assets: '' (префикс путей к фото), onBooking(state) }
   Состояние брони общее с hero: событие window 'schwarz:booking' (detail = частичное состояние). */
;(function () {
  'use strict'

  /* ── утилиты ── */
  var NB = ' '
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  /* заголовки из content.json: экранируем всё, затем разрешаем только <em> */
  var rich = function (s) { return esc(s).replace(/&lt;(\/?)em&gt;/g, '<$1em>') }
  var money = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽' }
  var num = function (n) { return String(n).replace('.', ',') }
  var plural = function (n, one, few, many) {
    var m10 = n % 10, m100 = n % 100
    if (m10 === 1 && m100 !== 11) return one
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
    return many
  }
  var days = function (n) { return n + NB + plural(n, 'сутки', 'суток', 'суток') }
  var pad = function (n) { return (n < 10 ? '0' : '') + n }
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  var human = function (s) { if (!s) return ''; var p = s.split('-'); return +p[2] + NB + MONTHS[+p[1] - 1] }
  var toDate = function (d, t) { if (!d) return null; var p = d.split('-'); var q = (t || '10:00').split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +q[0] || 0, +q[1] || 0) }
  var ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'
  var DIAG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M6 4h6v6"/></svg>'
  var CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg>'
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>'
  var BRANDS = ['Mercedes', 'BMW', 'Porsche', 'Audi']
  var DRIVE = { 'Полный': 'полный', 'Задний': 'задний', 'Передний': 'передний' }
  var reduced = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches }

  /* ── расчёт аренды ──
     сутки = 24 часа, первый час опоздания бесплатно; ступень тарифа по числу суток; доплата за место подачи */
  function quote(car, st, locations) {
    var a = toDate(st.from, st.fromTime)
    var b = toDate(st.to, st.toTime)
    if (!car || !a || !b) return null
    var hours = (b - a) / 36e5
    if (!(hours > 0)) return { error: 'Дата возврата должна быть позже получения' }
    var n = Math.max(1, Math.ceil((hours - 1) / 24))
    var tiers = (car.rent && car.rent.tiers) || [{ from: 1, to: null, price: car.rent.day }]
    var tier = tiers.filter(function (t) { return n >= t.from && (t.to == null || n <= t.to) })[0] || tiers[tiers.length - 1]
    var place = (locations || []).filter(function (l) { return l.id === st.place })[0]
    var fee = place ? place.fee || 0 : 0
    return { days: n, perDay: tier.price, tier: tier, fee: fee, total: tier.price * n + fee, deposit: car.rent.deposit, km: car.rent.km_per_day * n, place: place }
  }

  function mount(container, data, opts) {
    opts = opts || {}
    var A = opts.assets || ''
    var cars = (data.cars || []).filter(function (c) { return c.rent })
    var byId = {}
    cars.forEach(function (c) { byId[c.id] = c })
    var locations = data.locations || []
    var today = new Date()
    var t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    var t2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4)
    var state = { car: '', from: iso(t1), fromTime: '10:00', to: iso(t2), toTime: '10:00', place: locations[0] ? locations[0].id : '' }
    var filter = { brand: '', sort: 'featured' }

    var img = function (p) { return p ? A + p : '' }
    var cut = function (c, big) { return img(big ? c.photos.cutout : c.photos.cutout_sm || c.photos.cutout) }

    container.classList.add('tl')
    container.innerHTML =
      renderFleet() + renderSteps() + renderTerms() + renderServices() + renderFaq() + renderBooking() + renderFooter()
    var panel = document.createElement('div')
    panel.className = 'tl-panel'
    panel.hidden = true
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', 'Карточка машины')
    panel.innerHTML = '<div class="tl-scrim" data-close></div><div class="tl-sheet" tabindex="-1"><button type="button" class="tl-close" data-close aria-label="Закрыть">' + CLOSE + '</button><div data-sheet></div></div>'
    document.body.appendChild(panel)

    /* ── разметка ── */
    function head(block, extra) {
      return '<div class="tl-head tl-io"><div><p class="tl-eyebrow">' + esc(block.eyebrow) + '</p><h2>' + rich(block.title) + '</h2>' +
        (block.lede ? '<p class="tl-lede">' + esc(block.lede) + '</p>' : '') + '</div>' + (extra || '') + '</div>'
    }

    function renderFleet() {
      var f = data.fleet || {}
      var counts = {}
      cars.forEach(function (c) { BRANDS.forEach(function (b) { if (c.brand.indexOf(b) === 0) counts[b] = (counts[b] || 0) + 1 }) })
      var chips = '<button type="button" class="is-on" data-brand="">Все<span class="tl-count">' + cars.length + '</span></button>' +
        BRANDS.filter(function (b) { return counts[b] }).map(function (b) {
          return '<button type="button" data-brand="' + b + '">' + b + '<span class="tl-count">' + counts[b] + '</span></button>'
        }).join('')
      return '<section id="fleet" aria-labelledby="tl-fleet-h"><div class="tl-wrap">' +
        head({ eyebrow: f.eyebrow, title: f.title, lede: f.lede }).replace('<h2>', '<h2 id="tl-fleet-h">') +
        '<div class="tl-fleet-bar tl-io" style="--d:.08s">' +
        '<div class="tl-chips" role="group" aria-label="Марка">' + chips + '</div>' +
        '<div class="tl-dates" data-fleet-dates></div>' +
        '<label class="tl-sort"><span class="tl-mono">Порядок</span><select data-sort aria-label="Порядок машин"><option value="featured">Сначала главные</option><option value="cheap">Сначала дешевле</option><option value="expensive">Сначала дороже</option><option value="power">Мощнее</option></select></label>' +
        '</div>' +
        '<div class="tl-grid" data-grid>' + cars.map(renderCard).join('') +
        '<p class="tl-empty" data-empty hidden>' + esc(f.empty || 'Нет машин по этому фильтру.') + '</p></div>' +
        '</div></section>'
    }

    function renderCard(c, i) {
      return '<article class="tl-card tl-io" style="--d:' + (0.05 * (i % 4)).toFixed(2) + 's" data-id="' + esc(c.id) + '" data-brand="' + esc(c.brand) + '">' +
        '<div class="tl-shell"><div class="tl-core">' +
        '<button type="button" class="tl-stage" data-open="' + esc(c.id) + '" aria-label="Подробнее: ' + esc(c.brand + ' ' + c.name) + '">' +
        '<span class="tl-badge"><i style="background:' + esc(c.color.hex) + '"></i>' + esc(c.color.name) + '</span>' +
        '<span class="tl-year">' + esc(c.year) + '</span>' +
        '<span class="tl-floor" aria-hidden="true"></span>' +
        '<img loading="lazy" decoding="async" src="' + esc(cut(c)) + '" srcset="' + esc(cut(c) + ' 900w, ' + cut(c, true) + ' 1800w') + '" sizes="(max-width: 720px) 92vw, (max-width: 1100px) 46vw, 40vw" alt="' + esc(c.brand + ' ' + c.name + ', ' + c.color.name) + '" width="1800" height="900">' +
        '</button>' +
        '<div class="tl-info"><div class="tl-info-top"><span class="tl-brand">' + esc(c.brand) + ' · ' + esc(c.body) + '</span>' +
        '<h3 class="tl-name">' + esc(c.name) + '</h3>' +
        '<div class="tl-specs-row"><span><b>' + c.power_hp + '</b>л.с.</span><span><b>' + num(c.accel_0_100) + '</b>с до 100</span><span>' + esc(DRIVE[c.drive] || c.drive) + ' привод</span></div></div>' +
        '<div class="tl-buy"><div class="tl-price"><span class="tl-price-main">' + money(c.rent.day) + '<small>/ сутки</small></span><span class="tl-price-sub" data-sub></span></div>' +
        '<div class="tl-actions"><button type="button" class="tl-link" data-open="' + esc(c.id) + '">Подробнее</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-book="' + esc(c.id) + '"><span>Забронировать</span><span class="btn-ico">' + DIAG + '</span></button></div></div>' +
        '</div></div></div></article>'
    }

    function renderSteps() {
      var s = data.steps || { items: [] }
      return '<section id="how" aria-labelledby="tl-how-h" style="background:var(--bg-2)"><div class="tl-wrap">' + head(s).replace('<h2>', '<h2 id="tl-how-h">') +
        '<ol class="tl-steps" data-steps>' + s.items.map(function (x, i) {
          return '<li class="tl-step tl-io" style="--d:' + (0.1 * i).toFixed(2) + 's"><span class="tl-n">' + esc(x.n) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p></li>'
        }).join('') + '</ol></div></section>'
    }

    function renderTerms() {
      var t = data.terms || { items: [] }
      return '<section id="terms" aria-labelledby="tl-terms-h"><div class="tl-wrap tl-split">' +
        '<div class="tl-split-head tl-io"><p class="tl-eyebrow">' + esc(t.eyebrow) + '</p><h2 id="tl-terms-h">' + rich(t.title) + '</h2><p class="tl-lede">' + esc(t.lede) + '</p></div>' +
        '<dl class="tl-terms">' + t.items.map(function (x, i) {
          return '<div class="tl-term tl-io" style="--d:' + (0.04 * i).toFixed(2) + 's"><dt>' + esc(x.k) + '</dt><dd><b>' + esc(x.v) + '</b><span>' + esc(x.note) + '</span></dd></div>'
        }).join('') + '</dl></div></section>'
    }

    function renderServices() {
      var s = data.services || { items: [] }
      var letters = ['a', 'b', 'c', 'd', 'e']
      return '<section id="services" aria-labelledby="tl-svc-h" style="background:var(--bg-2)"><div class="tl-wrap">' + head(s).replace('<h2>', '<h2 id="tl-svc-h">') +
        '<div class="tl-bento">' + s.items.map(function (x, i) {
          var car = x.photo && byId[x.photo]
          var media = ''
          var cls = ''
          if (car && x.kind === 'cut') {
            cls = ' is-cut'
            media = '<div class="tl-svc-car" aria-hidden="true"><img loading="lazy" decoding="async" src="' + esc(cut(car)) + '" srcset="' + esc(cut(car) + ' 900w, ' + cut(car, true) + ' 1800w') + '" sizes="(max-width: 1100px) 90vw, 50vw" alt=""></div>'
          } else if (car && x.kind === 'photo') {
            var ph = (car.photos.gallery || []).filter(function (g) { return g.angle === (x.angle || 'interior') })[0] || car.photos.gallery[0]
            cls = ' has-photo'
            media = '<div class="tl-bg" aria-hidden="true"><img loading="lazy" decoding="async" src="' + esc(img(ph.sm || ph.src)) + '" srcset="' + esc(img(ph.sm || ph.src) + ' 900w, ' + img(ph.src) + ' 2000w') + '" sizes="(max-width: 1100px) 100vw, 42vw" alt=""></div>'
          }
          return '<article class="tl-svc tl-svc-' + letters[i] + cls + ' tl-io" style="--d:' + (0.06 * i).toFixed(2) + 's"><div class="tl-shell" style="height:100%"><div class="tl-core">' + media +
            '<div class="tl-svc-text"><span class="tl-meta">' + esc(x.meta) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p></div></div></div></article>'
        }).join('') + '</div></div></section>'
    }

    function renderFaq() {
      var f = data.faq || { items: [] }
      return '<section id="faq" aria-labelledby="tl-faq-h"><div class="tl-wrap">' + head(f).replace('<h2>', '<h2 id="tl-faq-h">') +
        '<div class="tl-faq">' + f.items.map(function (q, i) {
          return '<div class="tl-qa tl-io" style="--d:' + (0.04 * (i % 2)).toFixed(2) + 's"><span class="tl-qn">' + pad(i + 1) + '</span><h3>' + esc(q.q) + '</h3><p>' + esc(q.a) + '</p></div>'
        }).join('') + '</div></div></section>'
    }

    function carOptions(sel) {
      return '<option value="">Подберём вместе</option>' + cars.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (sel === c.id ? ' selected' : '') + '>' + esc(c.brand + ' ' + c.name) + ' · ' + money(c.rent.day) + '</option>'
      }).join('')
    }
    function placeOptions(sel) {
      return locations.map(function (l) { return '<option value="' + esc(l.id) + '"' + (sel === l.id ? ' selected' : '') + '>' + esc(l.name) + (l.fee ? ' · +' + money(l.fee) : '') + '</option>' }).join('')
    }

    function renderBooking() {
      var b = data.booking || {}
      var k = data.contacts || {}
      return '<section id="booking" aria-labelledby="tl-book-h" style="background:var(--bg-2)"><div class="tl-wrap tl-book">' +
        '<div class="tl-io"><p class="tl-eyebrow">' + esc(b.eyebrow) + '</p><h2 id="tl-book-h">' + rich(b.title) + '</h2><p class="tl-lede">' + esc(b.text) + '</p>' +
        '<dl class="tl-contacts"><div><dt>Телефон</dt><dd><a href="tel:' + esc(k.phone_href || '') + '">' + esc(k.phone) + '</a></dd></div>' +
        '<div><dt>Telegram</dt><dd>' + esc(k.telegram) + '</dd></div><div><dt>Офис</dt><dd>' + esc(k.address) + '</dd></div><div><dt>Работаем</dt><dd>' + esc(k.hours) + '</dd></div></dl></div>' +
        '<form class="tl-form tl-shell tl-io" style="--d:.1s" novalidate data-form><div class="tl-core">' +
        '<div class="tl-fields">' +
        '<div class="tl-summary" data-summary></div>' +
        '<label class="tl-field"><span>Автомобиль</span><select name="car" data-f-car>' + carOptions('') + '</select></label>' +
        '<div class="tl-row2"><label class="tl-field"><span>Получение</span><span class="tl-dt"><input type="date" name="from" data-f-from aria-label="Дата получения"><input type="time" name="fromTime" step="1800" aria-label="Время получения" data-f-fromtime></span></label>' +
        '<label class="tl-field"><span>Возврат</span><span class="tl-dt"><input type="date" name="to" data-f-to aria-label="Дата возврата"><input type="time" name="toTime" step="1800" aria-label="Время возврата" data-f-totime></span></label></div>' +
        '<label class="tl-field"><span>Где забрать</span><select name="place" data-f-place>' + placeOptions(state.place) + '</select></label>' +
        '<div class="tl-row2"><label class="tl-field"><span>Имя</span><input name="name" autocomplete="name" required aria-required="true" aria-describedby="err-name"><small class="tl-err" id="err-name" role="alert"></small></label>' +
        '<label class="tl-field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7" required aria-required="true" aria-describedby="err-phone"><small class="tl-err" id="err-phone" role="alert"></small></label></div>' +
        '<label class="tl-field"><span>Комментарий</span><textarea name="comment" placeholder="Например: подача в Шереметьево, терминал B"></textarea></label>' +
        '<label class="tl-consent"><input type="checkbox" name="consent" required><span>Понимаю, что это демонстрационный сайт: заявка никуда не отправится.</span></label>' +
        '<button type="submit" class="btn btn-primary"><span>' + esc(b.button || 'Отправить') + '</span><span class="btn-ico">' + ARROW + '</span></button>' +
        '<p class="tl-status" role="status" aria-live="polite"></p></div>' +
        '<div class="tl-done"><span class="tl-check">' + CHECK + '</span><h3>' + esc(b.success_title) + '</h3><p class="tl-mono" data-done-text></p><p style="color:var(--ink-dim)">' + esc(b.success_text) + '</p>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-reset><span>Новая заявка</span><span class="btn-ico">' + ARROW + '</span></button></div>' +
        '</div></form></div></section>'
    }

    function renderFooter() {
      var f = data.footer || {}
      var k = data.contacts || {}
      var credits = []
      cars.forEach(function (c) {
        ;((c.photos && c.photos.gallery) || []).forEach(function (g) {
          if (g.author) credits.push('<li>' + esc(c.brand + ' ' + c.name) + ', фото «<a href="' + esc(g.url) + '" rel="noopener">' + esc((g.label || '').toLowerCase()) + '</a>»: ' + esc(g.author) + ', ' + esc(g.license) + '</li>')
        })
        if (c.model3d && c.model3d.credit) credits.push('<li>' + esc(c.brand + ' ' + c.name) + ', 3D-модель «<a href="' + esc(c.model3d.credit.url) + '" rel="noopener">' + esc(c.model3d.credit.title) + '</a>»: ' + esc(c.model3d.credit.author) + ', ' + esc(c.model3d.credit.license) + '</li>')
      })
      return '<footer><div class="tl-foot">' +
        '<div><a href="#top" class="logo" style="font-weight:600;letter-spacing:.22em;text-transform:uppercase">Schwarz<i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px"></i></a>' +
        '<p style="margin-top:14px;max-width:34ch">' + esc((data.brand || {}).claim || '') + '. ' + esc(k.hours || '') + '.</p>' +
        '<div class="theme-switch" role="group" aria-label="Освещение сайта" data-themes><button type="button" data-theme-btn="night">Ночь</button><button type="button" data-theme-btn="chrome">Хром</button><button type="button" data-theme-btn="atelier">Ателье</button></div></div>' +
        '<div><h4>Разделы</h4><nav aria-label="Футер"><a href="#fleet">Автопарк</a><a href="#how">Как арендовать</a><a href="#terms">Условия</a><a href="#services">Услуги</a><a href="#booking">Бронирование</a></nav></div>' +
        '<div><h4>Контакты</h4><p><a href="tel:' + esc(k.phone_href || '') + '">' + esc(k.phone) + '</a><br>' + esc(k.telegram) + '<br>' + esc(k.email) + '<br>' + esc(k.address) + '</p></div>' +
        '</div>' +
        '<div class="tl-giant" aria-hidden="true">SCHWARZ</div>' +
        '<details class="tl-credits"><summary>' + esc(f.credits_title || 'Авторы') + ' · ' + credits.length + '</summary><p style="margin:6px 0 10px">' + esc(f.credits_note || '') + '</p><ul>' + credits.join('') + '</ul></details>' +
        '<div class="tl-legal"><span>' + esc(f.disclaimer || '') + '</span><span>© SCHWARZ, учебный проект</span></div>' +
        '</footer>'
    }

    /* ── автопарк: фильтр, сортировка, раскладка 7/5 ── */
    var grid = container.querySelector('[data-grid]')
    var empty = container.querySelector('[data-empty]')
    function applyFleet() {
      var list = cars.slice()
      if (filter.sort === 'cheap') list.sort(function (a, b) { return a.rent.day - b.rent.day })
      else if (filter.sort === 'expensive') list.sort(function (a, b) { return b.rent.day - a.rent.day })
      else if (filter.sort === 'power') list.sort(function (a, b) { return b.power_hp - a.power_hp })
      var shown = 0
      list.forEach(function (c) {
        var el = grid.querySelector('[data-id="' + c.id + '"]')
        var ok = !filter.brand || c.brand.indexOf(filter.brand) === 0
        el.classList.toggle('is-hidden', !ok)
        el.classList.remove('is-wide', 'is-narrow')
        if (ok) {
          var m = shown % 4
          el.classList.add(m === 0 || m === 3 ? 'is-wide' : 'is-narrow')
          shown++
        }
        grid.insertBefore(el, empty)
      })
      empty.hidden = shown > 0
    }
    container.querySelectorAll('.tl-chips [data-brand]').forEach(function (b) {
      b.addEventListener('click', function () {
        filter.brand = b.dataset.brand
        container.querySelectorAll('.tl-chips [data-brand]').forEach(function (x) { x.classList.toggle('is-on', x === b) })
        applyFleet()
      })
    })
    container.querySelector('[data-sort]').addEventListener('change', function (e) { filter.sort = e.target.value; applyFleet() })

    function paintPrices() {
      var datesEl = container.querySelector('[data-fleet-dates]')
      var q0 = quote(cars[0], state, locations)
      if (q0 && !q0.error) datesEl.innerHTML = '<span>с ' + esc(human(state.from)) + ' по ' + esc(human(state.to)) + ' · <b>' + esc(days(q0.days)) + '</b></span><a class="tl-link" href="#top" data-edit-dates>Изменить даты</a>'
      else datesEl.textContent = ''
      cars.forEach(function (c) {
        var el = grid.querySelector('[data-id="' + c.id + '"] [data-sub]')
        var q = quote(c, state, locations)
        if (!q || q.error) { el.textContent = ''; return }
        el.innerHTML = 'за ' + esc(days(q.days)) + ': <b>' + money(q.total) + '</b>'
      })
    }

    /* ── панель машины ── */
    var sheet = panel.querySelector('[data-sheet]')
    var lastFocus = null
    var current = null
    function open(id) {
      var c = byId[id]
      if (!c) return
      current = c
      lastFocus = document.activeElement
      var gal = [{ src: c.photos.cutout, sm: c.photos.cutout_sm, cut: true, label: 'Студия' }].concat(c.photos.gallery || [])
      var t = c.rent.tiers || []
      sheet.innerHTML =
        '<div class="tl-gal" data-gal><img alt="' + esc(c.brand + ' ' + c.name) + '" src="' + esc(img(gal[1] ? gal[1].src : gal[0].src)) + '"' + (gal[1] ? '' : ' class="is-cut"') + '></div>' +
        '<div class="tl-thumbs" role="group" aria-label="Фото">' + gal.map(function (g, i) {
          return '<button type="button" data-g="' + i + '"' + (i === (gal[1] ? 1 : 0) ? ' class="is-on"' : '') + ' aria-label="Фото: ' + esc(g.label) + '"><img loading="lazy" src="' + esc(img(g.sm || g.src)) + '" alt=""' + (g.cut ? ' class="is-cut"' : '') + '></button>'
        }).join('') + '</div>' +
        '<div class="tl-body">' +
        '<div class="tl-title"><span class="tl-brand">' + esc(c.brand) + ' · ' + esc(c.year) + ' · ' + esc(c.body) + '</span><h3>' + esc(c.name) + '</h3><p>' + esc(c.tagline) + '</p></div>' +
        '<div class="tl-specs"><div><b>' + c.power_hp + '</b><span>л.с.</span></div><div><b>' + num(c.accel_0_100) + '</b><span>0-100, с</span></div><div><b>' + c.torque_nm + '</b><span>Нм</span></div><div><b>' + c.top_speed + '</b><span>км/ч</span></div></div>' +
        '<div><p class="tl-sub">Цена за сутки</p><div class="tl-tariffs" data-tariffs>' + t.map(function (x, i) {
          var label = x.to == null ? 'от ' + x.from + ' дней' : (x.from === x.to ? x.from + ' сут.' : x.from + '-' + x.to + ' дн.')
          return '<div class="tl-tariff" data-tier="' + i + '"><span>' + esc(label) + '</span><b>' + money(x.price) + '</b></div>'
        }).join('') + '</div></div>' +
        '<div><p class="tl-sub">В цене</p><ul class="tl-incl"><li>ОСАГО и КАСКО</li><li>' + c.rent.km_per_day + ' км в сутки</li><li>Подача в пределах МКАД</li><li>Мойка и полный бак</li><li>Залог ' + money(c.rent.deposit) + ', вернём в день сдачи</li><li>' + esc(c.engine) + ', ' + esc(DRIVE[c.drive] || c.drive) + ' привод</li></ul></div>' +
        '<div class="tl-calc"><div class="tl-calc-in">' +
        '<div class="tl-calc-row"><label class="tl-field"><span>Получение</span><span class="tl-dt"><input type="date" data-p-from aria-label="Дата получения" value="' + esc(state.from) + '"><input type="time" step="1800" data-p-fromtime aria-label="Время получения" value="' + esc(state.fromTime) + '"></span></label>' +
        '<label class="tl-field"><span>Возврат</span><span class="tl-dt"><input type="date" data-p-to aria-label="Дата возврата" value="' + esc(state.to) + '"><input type="time" step="1800" data-p-totime aria-label="Время возврата" value="' + esc(state.toTime) + '"></span></label></div>' +
        '<label class="tl-field"><span>Где забрать</span><select data-p-place>' + placeOptions(state.place) + '</select></label>' +
        '<div class="tl-total"><div><div class="tl-total-sum" data-p-total></div><div class="tl-total-note" data-p-note></div></div>' +
        '<button type="button" class="btn" data-p-book><span>Забронировать</span><span class="btn-ico">' + ARROW + '</span></button></div>' +
        '</div></div>' +
        '<p class="tl-credit">' + (c.photos.gallery || []).map(function (g) { return esc(g.label) + ': <a href="' + esc(g.url) + '" rel="noopener">' + esc(g.author) + '</a>, ' + esc(g.license) }).join(' · ') + '</p>' +
        '</div>'
      var galImg = sheet.querySelector('[data-gal] img')
      sheet.querySelectorAll('[data-g]').forEach(function (b) {
        b.addEventListener('click', function () {
          var g = gal[+b.dataset.g]
          galImg.src = img(g.src)
          galImg.classList.toggle('is-cut', !!g.cut)
          sheet.querySelectorAll('[data-g]').forEach(function (x) { x.classList.toggle('is-on', x === b) })
        })
      })
      var sync = function () {
        setState({
          from: sheet.querySelector('[data-p-from]').value, fromTime: sheet.querySelector('[data-p-fromtime]').value,
          to: sheet.querySelector('[data-p-to]').value, toTime: sheet.querySelector('[data-p-totime]').value,
          place: sheet.querySelector('[data-p-place]').value,
        }, 'panel')
      }
      sheet.querySelectorAll('[data-p-from],[data-p-fromtime],[data-p-to],[data-p-totime],[data-p-place]').forEach(function (el) { el.addEventListener('change', sync) })
      sheet.querySelector('[data-p-book]').addEventListener('click', function () { close(); book(c.id) })
      paintPanel()
      panel.hidden = false
      document.documentElement.style.overflow = 'hidden'
      requestAnimationFrame(function () { panel.classList.add('is-open') })
      panel.querySelector('.tl-sheet').scrollTop = 0
      setTimeout(function () { panel.querySelector('.tl-close').focus() }, 60)
    }
    function paintPanel() {
      if (!current || panel.hidden && !sheet.firstChild) return
      var q = quote(current, state, locations)
      var tot = sheet.querySelector('[data-p-total]')
      var note = sheet.querySelector('[data-p-note]')
      if (!tot) return
      if (!q) { tot.textContent = money(current.rent.day); note.textContent = 'за сутки'; return }
      if (q.error) { tot.textContent = '·'; note.textContent = q.error; return }
      tot.textContent = money(q.total)
      note.textContent = days(q.days) + ' по ' + money(q.perDay) + (q.fee ? ' + подача ' + money(q.fee) : '') + ' · залог ' + money(q.deposit)
      sheet.querySelectorAll('[data-tier]').forEach(function (el, i) { el.classList.toggle('is-on', current.rent.tiers[i] === q.tier) })
    }
    function close() {
      if (panel.hidden) return
      panel.classList.remove('is-open')
      document.documentElement.style.overflow = ''
      setTimeout(function () { panel.hidden = true; current = null }, reduced() ? 0 : 600)
      if (lastFocus && lastFocus.focus) lastFocus.focus()
    }
    panel.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close() })
    document.addEventListener('keydown', function (e) {
      if (panel.hidden) return
      if (e.key === 'Escape') close()
      if (e.key === 'Tab') {
        var f = panel.querySelectorAll('button, [href], input, select, textarea')
        if (!f.length) return
        var first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    })

    /* ── бронирование ── */
    var form = container.querySelector('[data-form]')
    var F = function (s) { return form.querySelector(s) }
    function paintForm() {
      F('[data-f-car]').value = state.car
      F('[data-f-from]').value = state.from
      F('[data-f-fromtime]').value = state.fromTime
      F('[data-f-to]').value = state.to
      F('[data-f-totime]').value = state.toTime
      F('[data-f-place]').value = state.place
      var c = byId[state.car]
      var sum = F('[data-summary]')
      sum.classList.toggle('is-empty', !c)
      if (!c) { sum.innerHTML = '<div><span class="tl-mono">Машина не выбрана: подберём вместе</span><br><b>' + esc(days(Math.max(1, (quote(cars[0], state, locations) || {}).days || 1))) + '</b></div>'; return }
      var q = quote(c, state, locations)
      sum.innerHTML = '<div class="tl-sum-img"><img src="' + esc(cut(c)) + '" alt=""></div><div><span class="tl-mono">' + esc(c.brand + ' ' + c.name) + '</span><br><b>' + (q && !q.error ? money(q.total) : money(c.rent.day)) + '</b><br><span class="tl-mono">' + (q && !q.error ? esc(days(q.days) + ' · залог ' + money(q.deposit)) : esc(q && q.error ? q.error : 'за сутки')) + '</span></div>'
    }
    form.addEventListener('change', function (e) {
      if (!e.target.name || ['car', 'from', 'fromTime', 'to', 'toTime', 'place'].indexOf(e.target.name) < 0) return
      var p = {}
      p[e.target.name] = e.target.value
      setState(p, 'form')
    })
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var name = form.elements.name, phone = form.elements.phone, consent = form.elements.consent
      var bad = null
      F('#err-name').textContent = ''
      F('#err-phone').textContent = ''
      name.setAttribute('aria-invalid', 'false')
      phone.setAttribute('aria-invalid', 'false')
      if (!name.value.trim()) { F('#err-name').textContent = 'Как к вам обращаться?'; name.setAttribute('aria-invalid', 'true'); bad = bad || name }
      if (!/^\+?[\d\s()-]{10,}$/.test(phone.value.trim())) { F('#err-phone').textContent = 'Номер из 10-11 цифр'; phone.setAttribute('aria-invalid', 'true'); bad = bad || phone }
      var q = quote(byId[state.car] || cars[0], state, locations)
      if (q && q.error) { F('.tl-status').textContent = q.error; bad = bad || F('[data-f-to]') }
      else if (!consent.checked) { F('.tl-status').textContent = 'Отметьте, что понимаете: это демо.'; bad = bad || consent }
      else F('.tl-status').textContent = ''
      if (bad) { bad.focus(); return }
      var c = byId[state.car]
      F('[data-done-text]').textContent = (c ? c.brand + ' ' + c.name + ' · ' : '') + 'с ' + human(state.from) + ' по ' + human(state.to) + (c && q ? ' · ' + money(q.total) : '')
      form.classList.add('is-done')
      F('[data-reset]').focus()
    })
    F('[data-reset]').addEventListener('click', function () {
      form.elements.name.value = ''
      form.elements.phone.value = ''
      form.elements.comment.value = ''
      form.elements.consent.checked = false
      form.classList.remove('is-done')
      form.elements.name.focus()
    })
    function book(id) {
      setState({ car: id }, 'book')
      var sec = container.querySelector('#booking')
      if (sec) sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
      setTimeout(function () { form.elements.name.focus({ preventScroll: true }) }, reduced() ? 0 : 700)
    }

    /* ── общее состояние ── */
    function setState(p, source) {
      var changed = false
      Object.keys(p).forEach(function (k) { if (p[k] != null && state[k] !== p[k]) { state[k] = p[k]; changed = true } })
      if (!changed && source !== 'init') return
      paintPrices()
      paintForm()
      paintPanel()
      if (source !== 'external') window.dispatchEvent(new CustomEvent('schwarz:booking-changed', { detail: Object.assign({}, state) }))
      if (opts.onBooking) opts.onBooking(Object.assign({}, state))
    }
    window.addEventListener('schwarz:booking', function (e) { setState(e.detail || {}, 'external') })

    container.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]')
      if (o) { open(o.dataset.open); return }
      var b = e.target.closest('[data-book]')
      if (b) { e.preventDefault(); book(b.dataset.book); return }
      var ed = e.target.closest('[data-edit-dates]')
      if (ed) { e.preventDefault(); window.dispatchEvent(new CustomEvent('schwarz:edit-dates')) }
    })

    /* шаги загораются по очереди */
    var steps = container.querySelector('[data-steps]')
    if (steps && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en, ob) {
        en.forEach(function (x) {
          if (!x.isIntersecting) return
          steps.style.setProperty('--p', '1')
          steps.querySelectorAll('.tl-step').forEach(function (s, i) { setTimeout(function () { s.classList.add('is-on') }, reduced() ? 0 : 420 * i + 200) })
          ob.disconnect()
        })
      }, { threshold: 0.35 }).observe(steps)
    }

    /* появление */
    var ios = container.querySelectorAll('.tl-io')
    if (!('IntersectionObserver' in window) || reduced()) ios.forEach(function (el) { el.classList.add('is-in') })
    else {
      var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target) } }) }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 })
      ios.forEach(function (el) { io.observe(el) })
    }

    applyFleet()
    setState({}, 'init')
    var api = {
      setBooking: function (p) { setState(p || {}, 'external') },
      open: open,
      book: book,
      state: function () { return Object.assign({}, state) },
      quote: function (id) { return quote(byId[id], state, locations) },
      refresh: function () { paintPrices(); paintForm() },
    }
    window.SchwarzTail.last = api
    return api
  }

  window.SchwarzTail = { mount: mount, money: money, quote: quote, days: days, human: human, iso: iso }
})()
