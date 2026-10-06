# Школьный портал

Отдельный проект: вход по логину/паролю для администрации, учителей и учеников.  
Данные — **Google Таблица**, сайт для пользователей — **Apps Script Web App** (постоянная ссылка).

Не связан с Telegram, Mini App и quiz-bot.

---

## Рекомендуемый способ (постоянный сайт без туннеля)

1. Таблица «Школьный портал» + Apps Script Web App  
2. Пошагово: **[google-sheets/SETUP-RU.md](google-sheets/SETUP-RU.md)**  
3. В Apps Script: `Code.gs`, `WebApp`, `PortalStyles`, `PortalScript` (после правок UI: `python3 google-sheets/build_gas_assets.py`)  
4. Ссылка вида `https://script.google.com/macros/s/…/exec` — для учеников и учителей, как у портфолио на Google.

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
