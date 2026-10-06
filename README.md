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

## Локальный демо-сервер (полный функционал)

```bash
pip install -r requirements.txt
./run.sh
```

Откройте **http://127.0.0.1:8080** — те же экраны, что в перенесённом проекте; данные в памяти (`demo_data.py`), без Google Таблицы.

В **Cloud Agent** портал поднимается автоматически (`install` + `start` в `.cursor/environment.json`), порт **8080**.

Публичная ссылка без своего сервера: `./run_with_tunnel.sh` (нужен [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)); URL появится в `logs/tunnel-url.txt`.

## Демо-логины (после `initializeSheets` или локально)

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | `admin` | `admin123` |
| Учитель | `teacher` | `teacher123` |
| Ученик | `student1` | `student123` |
