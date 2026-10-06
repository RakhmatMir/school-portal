# Школьный портал (демо)

Тестовый портал: вход, классы, тесты, кабинет учителя и ученика.  
**Все данные в одном файле** — [`data/portal.json`](data/portal.json). Google Таблица **не нужна**.

Сайт на **GitHub Pages**: https://rakhmatmir.github.io/school-portal/

Не связан с Telegram, Mini App и quiz-bot.

---

## Как устроено

| Что | Где |
|-----|-----|
| Школа, классы, тесты, вопросы | `data/portal.json` |
| Логины (демо, без защиты) | `demo_users` в том же JSON |
| Интерфейс | `index.html`, `static/` |
| Сдачи тестов | `localStorage` в браузере (для демо) |

`static/js/portal-config.js` — оставьте `PORTAL_API_URL` пустым. Таблица и Apps Script не используются.

Подробнее про поля JSON: [data/README.md](data/README.md).

---

## Демо-логины

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | `admin` | `admin123` |
| Учитель | `teacher` | `teacher123` |
| Ученик | `student1` | `student123` |

Пароли в открытом виде в репозитории — **намеренно**, это только демонстрация.

---

## Локально (по желанию)

```bash
pip install -r requirements.txt
./run.sh
```

http://127.0.0.1:8080 — тот же интерфейс; данные из `demo_data.py` (копия содержимого JSON).

---

## Публикация на GitHub Pages

1. **Settings → Pages → Source: GitHub Actions** (один раз).  
2. Push в `main` — workflow **Deploy GitHub Pages** собирает сайт.  
3. Открыть: `https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПО/` (не корень `github.io`).

Кратко: [ВКЛЮЧИТЬ-SITE.md](ВКЛЮЧИТЬ-SITE.md).

Папка `google-sheets/` — старый вариант с таблицей; для демо можно не трогать.
