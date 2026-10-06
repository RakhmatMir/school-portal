# Школьный портал

Отдельный проект: вход по логину/паролю для администрации, учителей и учеников.  
Данные — **Google Таблица**, сайт для пользователей — **Apps Script Web App** (постоянная ссылка).

Не связан с Telegram, Mini App и quiz-bot.

---

## Рекомендуемый способ (Google)

1. Таблица «Школьный портал» + Apps Script  
2. Инструкция: **[google-sheets/SETUP-RU.md](google-sheets/SETUP-RU.md)**  
3. Файлы: `google-sheets/Code.gs`, `google-sheets/WebApp.html`

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
