@echo off
chcp 65001 >nul
set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8126" ^| findstr "LISTENING"') do (
  set FOUND=1
  taskkill /PID %%p /F >nul 2>&1
)
if "%FOUND%"=="1" (
  echo 已停止 8126 本地预览服务。
) else (
  echo 8126 端口当前没有本地预览服务。
)
timeout /t 2 >nul
