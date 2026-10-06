# Школьный портал

Отдельный проект: вход по логину/паролю для администрации, учителей и учеников.  
Данные — **Google Таблица**, сайт для пользователей — **Apps Script Web App** (постоянная ссылка).

Не связан с Telegram, Mini App и quiz-bot.

---

## Рекомендуемый способ (как портфолио на GitHub + таблица как БД)

1. **Сайт** — GitHub Pages (`index.html` + `static/`)  
2. **Данные** — Google Таблица  
3. **API** — Apps Script (`Code.gs`), один URL `…/exec`  
4. Инструкция: **[google-sheets/GITHUB-PAGES-RU.md](google-sheets/GITHUB-PAGES-RU.md)**  
5. В `static/js/portal-config.js` укажите `PORTAL_API_URL` после развёртывания скрипта.

Альтернатива (всё на Google одной ссылкой): **[google-sheets/SETUP-RU.md](google-sheets/SETUP-RU.md)** — WebApp + HTML-вложения.

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
