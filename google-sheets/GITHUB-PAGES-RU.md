# GitHub Pages (сайт) + Google Таблица (только вход)

| Что | Где |
|-----|-----|
| **Сайт** (экраны, тесты, классы) | GitHub → `index.html`, `static/`, **`data/portal.json`** |
| **Логин и пароль** | Google Таблица → лист **`users`** |
| **Проверка пароля** | Apps Script → URL `…/exec` (только API входа) |

Туннель не нужен.

---

## 1. Таблица — только пользователи

1. Таблица: https://docs.google.com/spreadsheets/d/1R7IwEg0gmvBnGal8oswynX6AdTTmGwezjx10BFWvHuw/edit  
2. **Расширения → Apps Script** → вставьте **`Code.gs`** из репозитория.  
3. Запустите **`initializeSheets`** — появится лист **`users`** с колонками:

| login | password | role | full_name | class_name | id |
|-------|----------|------|-----------|------------|-----|

Роль: `admin`, `teacher` или `student`. Для ученика укажите класс (например `6Б`).

4. **Развернуть → Новое развёртывание → Веб-приложение**  
   - Выполнять от имени: **Я**  
   - Доступ: **Все**  
5. Скопируйте **URL веб-приложения** (`…/exec`).

Проверка (в браузере не обязательна): API отвечает только на `/api/login`, `/api/me`, `/api/logout`.

---

## 2. GitHub — весь контент портала

1. Редактируйте **`data/portal.json`** в репозитории: название школы, классы, предметы, экзамены, вопросы.  
2. В **`static/js/portal-config.js`**:

```javascript
window.PORTAL_API_URL = "https://script.google.com/macros/s/ВАШ_ID/exec";
```

3. Push в **main** → GitHub Pages (workflow в `.github/workflows/pages.yml`).  
4. Сайт: `https://ВАШ_ЛОГИН.github.io/school-portal/`

Сдачи тестов сохраняются **в браузере** (localStorage), не в таблице.

---

## 3. Локальная разработка

- `PORTAL_API_URL` пустой + `./run.sh` — полный демо-сервер на :8080 (всё в памяти).  
- Или укажите `PORTAL_API_URL` и откройте сайт локально через простой HTTP-сервер — данные из `data/portal.json`, вход из таблицы.

---

## Ошибки

| Симптом | Решение |
|---------|---------|
| «Файл не обнаружен» на script.google.com | Нужен URL после **Развернуть**, с **`/exec`** |
| Школа не грузится на GitHub | Проверьте, что в Pages попала папка **`data/`** |
| Не входит | Логин/пароль на листе `users`, `PORTAL_API_URL` в config |
