@echo off
setlocal
cd /d "%~dp0"
set PORT=8080
if not "%PORT_OVERRIDE%"=="" set PORT=%PORT_OVERRIDE%

echo.
echo Установка зависимостей (если ещё не ставили)...
python -m pip install -r requirements.txt -q

set PORT=%PORT%
python scripts\print_portal_urls.py

echo Запуск сервера. Окно не закрывайте — пока оно открыто, ноут ходит на этот ПК.
echo.
python -m uvicorn main:app --host 0.0.0.0 --port %PORT%
