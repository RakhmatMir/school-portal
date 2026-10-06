# Google Таблица — только вход на сайт

Контент портала (тесты, классы, вопросы) хранится в **GitHub**: файл **`data/portal.json`**.

Таблица нужна **только** для логина и пароля (лист `users`).

Полная инструкция по сайту на GitHub: **[GITHUB-PAGES-RU.md](GITHUB-PAGES-RU.md)**.

---

## Быстрый старт (Apps Script)

1. Таблица: https://docs.google.com/spreadsheets/d/1R7IwEg0gmvBnGal8oswynX6AdTTmGwezjx10BFWvHuw/edit  
2. **Расширения → Apps Script** → вставьте **`Code.gs`**.  
3. **`initializeSheets`** → лист `users`.  
4. **Развернуть → Веб-приложение** (доступ **Все**) → URL `…/exec` в `static/js/portal-config.js` на GitHub.

## Лист users

| login | password | role | full_name | class_name | id |
|-------|----------|------|-----------|------------|-----|

Демо после `initializeSheets`: `admin` / `teacher` / `student1` (пароли в GITHUB-PAGES-RU.md).
