@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts/build-kb.mjs
if errorlevel 1 (
  echo 构建失败，请检查 Node.js 和 knowledge/source。
) else (
  echo 构建完成：assets/kb.json
)
pause
