# Школьный портал (демо)

Тестовый портал: вход, классы, тесты, кабинет администратора и ученика.  
**Все данные в одном файле** — [`data/portal.json`](data/portal.json).

Сайт: **https://rakhmatmir.github.io/school-portal/**

---

## Как устроено

| Что | Где |
|-----|-----|
| Школа, классы, тесты, вопросы | `data/portal.json` |
| Логины (демо) | `demo_users` в том же JSON |
| Интерфейс | `index.html`, `static/js/portal.js` |
| Сдачи тестов | `localStorage` в браузере |

Справка по полям JSON: [data/README.md](data/README.md).

---

## Демо-логины

| Роль | Логин | Пароль |
|------|-------|--------|
| Администратор | `admin` | `admin123` |
| Ученик 6Б | `6b01` … `6b19` | индивидуально (см. `data/6b-student-logins.txt`) |

---

## Локально (опционально)

```bash
pip install -r requirements.txt
./run.sh
```

http://127.0.0.1:8080 — FastAPI + `demo_data.py` (аналог JSON).

---

## GitHub Pages

**Settings → Pages → GitHub Actions**, push в `main`.  
Кратко: [ВКЛЮЧИТЬ-SITE.md](ВКЛЮЧИТЬ-SITE.md).
