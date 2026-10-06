# Школьный портал

Отдельный проект: вход по логину/паролю для администрации, учителей и учеников.  
Данные — **Google Таблица**, сайт для пользователей — **Apps Script Web App** (постоянная ссылка).

Не связан с Telegram, Mini App и quiz-bot.

---

## Рекомендуемый способ (GitHub + таблица только для входа)

1. **Сайт и контент** — GitHub Pages: `index.html`, `static/`, **`data/portal.json`** (классы, тесты, вопросы).  
2. **Логин и пароль** — лист **`users`** в Google Таблице.  
3. **Проверка входа** — Apps Script `Code.gs` → URL в `static/js/portal-config.js`.  
4. Инструкция: **[google-sheets/GITHUB-PAGES-RU.md](google-sheets/GITHUB-PAGES-RU.md)**.

---

## Локальный демо-сервер (опционально)

```bash
pip install -r requirements.txt
./run.sh
```

http://127.0.0.1:8080 — те же экраны, данные в памяти (не таблица).

## Демо-логины (после `initializeSheets` или локально)

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | `admin` | `admin123` |
| Учитель | `teacher` | `teacher123` |
| Ученик | `student1` | `student123` |
