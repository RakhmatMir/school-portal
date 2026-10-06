# Сайт на GitHub Pages + таблица как база

Схема как у портфолио на GitHub:

| Что | Где |
|-----|-----|
| Интерфейс (HTML/CSS/JS) | **GitHub Pages** — `https://ВАШ_ЛОГИН.github.io/school-portal/` |
| Данные | **Google Таблица** (листы `users`, `exams`, …) |
| API (логин, тесты) | **Apps Script** — один URL `…/exec` |

Туннель не нужен.

---

## Шаг 1. API в Google (таблица + скрипт)

1. Таблица: https://docs.google.com/spreadsheets/d/1R7IwEg0gmvBnGal8oswynX6AdTTmGwezjx10BFWvHuw/edit  
2. **Расширения → Apps Script** → вставьте **`Code.gs`** из репозитория (достаточно одного файла `Code.gs` для API; HTML-файлы WebApp нужны только если хотите открывать сайт с `script.google.com`).  
3. Запустите **`initializeSheets`**.  
4. **Развернуть → Новое развёртывание → Веб-приложение**  
   - Выполнять от имени: **Я**  
   - Доступ: **Все**  
5. Скопируйте **URL веб-приложения** (`https://script.google.com/macros/s/…/exec`).

Проверка API в браузере (должен вернуть JSON):

`https://script.google.com/macros/s/ВАШ_ID/exec?api=1&path=/api/public/landing&method=GET`

---

## Шаг 2. GitHub Pages (фронтенд)

1. В репозитории на GitHub: **Settings → Pages**  
   - Source: **GitHub Actions** (workflow `Deploy GitHub Pages` уже в репозитории)  
   - либо ветка **main**, папка **/ (root)**  
2. В файле **`static/js/portal-config.js`** укажите URL из шага 1:

```javascript
window.PORTAL_API_URL = "https://script.google.com/macros/s/ВАШ_ID/exec";
```

3. Закоммитьте и запушьте в **main**.  
4. Через 1–2 минуты откройте сайт:  
   `https://ВАШ_ЛОГИН.github.io/school-portal/`  
   (имя папки = имя репозитория, если не настроен custom domain).

---

## Шаг 3. Логины

После `initializeSheets` — как в [SETUP-RU.md](SETUP-RU.md): `admin` / `teacher` / `student1`.

---

## Обновление

- Поменяли дизайн/JS → push в GitHub (Pages обновится).  
- Поменяли логику API → обновите `Code.gs` в Apps Script → **Новая версия** развёртывания.  
- Поменяли данные → правьте листы в таблице.

---

## Ошибки

| Симптом | Что сделать |
|---------|-------------|
| «Файл не обнаружен» на script.google.com | Неверный URL; нужен именно **/exec** после развёртывания |
| На GitHub пусто / не грузится школа | Проверьте `PORTAL_API_URL` в `portal-config.js` |
| CORS / сеть в консоли | У Web App доступ **Все**; URL без лишних пробелов |
| Локально `./run.sh` | Оставьте `PORTAL_API_URL = ""` — работает FastAPI на :8080 |
