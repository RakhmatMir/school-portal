# Один раз включить сайт на GitHub

Код уже в ветке **main**. Осталось **2 шага** (без этого сайт 404).

## 1. GitHub Pages (1 минута)

1. Откройте: https://github.com/RakhmatMir/school-portal/settings/pages  
2. **Build and deployment → Source:** выберите **GitHub Actions** (не «Deploy from branch»).  
3. Сохраните. Зайдите в **Actions** → workflow **Deploy GitHub Pages** → **Run workflow** (или сделайте любой push в `main`).

Сайт: **https://rakhmatmir.github.io/school-portal/**  
(должна открыться форма входа; название школы — из `data/portal.json`).

## 2. Вход через Google Таблицу

1. Таблица → **Расширения → Apps Script** → вставьте `google-sheets/Code.gs` → **`initializeSheets`**.  
2. **Развернуть → Веб-приложение** (доступ **Все**) → скопируйте URL `…/exec`.  
3. GitHub → **Settings → Secrets and variables → Actions** → **New repository secret**  
   - Name: `PORTAL_APPS_SCRIPT_URL`  
   - Value: ваш URL `https://script.google.com/macros/s/…/exec`  
4. **Actions** → снова запустите **Deploy GitHub Pages** (чтобы секрет попал в `portal-config.js`).

Вход: `student1` / `student123` (если не меняли лист `users`).

Подробнее: [google-sheets/GITHUB-PAGES-RU.md](google-sheets/GITHUB-PAGES-RU.md).
