@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "hotel-xiaoer-preview" "D:\workspace\huanjing\python\python.exe" -m http.server 8126 --bind 127.0.0.1
timeout /t 1 >nul
start "" "http://127.0.0.1:8126/"
