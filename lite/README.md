# site-lite: SCHWARZ без 3D

Статичный сайт: HTML + CSS + JS, без сборщика. Открывается двойным кликом по `index.html`
или через `python -m http.server 8181` из этой папки. Те же тексты, данные, токены и хвост,
что у site-3d. Три темы переключаются кружками в шапке (`?theme=night|chrome|atelier`).

## Структура

```
site-lite/
├── index.html        # шапка, hero, пять героев, сцена цвета, контейнер #tail
├── styles.css        # стили этой страницы (шапка, hero, герои, цвет)
├── app.js            # темы, герои из данных, смена цвета, шапка, reveal, монтирование хвоста
├── tokens.css        # копия brand/design-system/tokens.css          ← sync
├── tail.css, tail.js # копия site-3d/src/tail/ (каталог, услуги, FAQ, форма, футер) ← sync
├── data/cars.js      # window.SCHWARZ_CARS из catalog/cars.json       ← sync
├── data/content.js   # window.SCHWARZ_CONTENT из catalog/content.json ← sync
├── renders/<theme>/  # копия assets/images/renders                    ← sync
└── scripts/sync.py   # пересобирает всё выше из источников
```

## Как править

- **Тексты, цены, машины:** только в `catalog/cars.json` и `catalog/content.json`, затем
  `python scripts/sync.py`. Руками в `data/` не лезть, файлы перезаписываются.
- **Цвета и шрифты:** `brand/design-system/tokens.css`, затем sync.
- **Каталог, услуги, FAQ, форма, футер:** `site-3d/src/tail/tail.js` и `tail.css`, затем sync.
  Это общий код двух сайтов.
- **Hero, пять героев, сцена цвета:** здесь, в `index.html`, `styles.css`, `app.js`.
- **Рендеры:** снимаются студией site-3d (`studio.html`) через
  `C:\Projects\schwarz-models-src\shoot.mjs jobs-renders.json`, кладутся в
  `assets/images/renders`, затем sync.

## Добавить машину

1. Положить `<id>.glb` в `assets/models/` (контракт в `assets/models/LICENSES.md`).
2. Добавить запись в `catalog/cars.json` (цена с источником и датой, `credit` для CC-BY).
3. Снять рендеры `<id>-34f/side/34r` в трёх темах, положить в `assets/images/renders`.
4. `python scripts/sync.py`.

## Проверено 2026-10-02

Десктоп 1440×900 и телефон 390×844: вылезаний нет, консоль чистая, фильтры, карточка,
смена цвета, форма (демо, success-состояние), FAQ, бургер, Tab-навигация со skip-link.
