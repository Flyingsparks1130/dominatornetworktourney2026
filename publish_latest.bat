@echo off
setlocal
cd /d "%~dp0"
echo.
echo UMA Race Publisher
echo ==================
echo.
py scripts\publish_race.py --git-push
echo.
pause
