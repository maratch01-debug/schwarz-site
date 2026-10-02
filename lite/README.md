# site-lite: SCHWARZ без 3D (v2, прокат)

Статичный сайт: HTML + CSS + JS, без сборщика. Открывается двойным кликом по `index.html`
или через `python -m http.server 8181` из этой папки. Те же тексты, данные, токены и хвост,
что у site-3d. Три темы: переключатель в футере и в мобильном меню, `?theme=night|chrome|atelier`.
Опубликован: https://maratch01-debug.github.io/schwarz-site/lite/

## Структура

```
site-lite/
├── index.html        # шапка-остров, мобильное меню, hero (вырезки + панель дат), факты, контейнер #tail
├── styles.css        # оболочка: база, кнопки, шапка, меню, hero, панель дат, факты
├── app.js            # темы, карусель hero, панель дат → событие schwarz:booking, монтирование хвоста
├── tokens.css        # копия brand/design-system/tokens.css                       ← sync
├── tail.css, tail.js # копия site-3d/src/tail/ (автопарк, панель машины, шаги, условия,
│                     #   услуги, FAQ, бронь, футер)                                  ← sync
├── data/cars.js      # window.SCHWARZ_CARS из catalog/cars.json                     ← sync
├── data/content.js   # window.SCHWARZ_CONTENT из catalog/content.json               ← sync
├── photos/<id>/      # копия assets/photos (вырезки и галереи, webp)                ← sync
└── scripts/sync.py   # пересобирает всё выше из источников
```

## Как править

- **Тексты, тарифы, машины:** `catalog/content.json` руками, `catalog/cars.json` через
  `C:\Projects\schwarz-models-src\build_fleet.py`, затем `python scripts/sync.py`.
  В `data/` руками не лезть, файлы перезаписываются.
- **Цвета и шрифты:** `brand/design-system/tokens.css`, затем sync.
- **Всё ниже фактов (автопарк, панель, бронь, футер):** `site-3d/src/tail/tail.js` и `tail.css`,
  затем sync. Это общий код двух сайтов, он самодостаточен (своя база стилей).
- **Шапка, меню, hero, панель дат, факты:** здесь, в `index.html`, `styles.css`, `app.js`.

## Добавить машину

1. Фото с Wikimedia Commons (CC0/BY/BY-SA): `commons.py` → `C:\Projects\schwarz-photos\<id>\`
   с `credits.json`, вырезка `cutout.py`, при мусоре `erase.py`.
2. Запись в `build_fleet.py` (тариф, залог, км, источники с датой), сборка `cars.json`.
3. `python scripts/sync.py`, прогон `node C:\Projects\schwarz-models-src\test-v2.mjs`.

## Проверено 2026-10-03

`test-v2.mjs` 20/20: темы, карусель hero, пересчёт цен по датам и ступеням, коррекция дат,
фильтр и сортировка, панель машины (фокус, Escape, галерея, подача в аэропорт), перенос в форму,
ошибки и успех формы, мобильное меню, нет горизонтального скролла на 390, skip-link, консоль чистая.
