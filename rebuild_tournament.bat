@echo off
setlocal
cd /d "%~dp0"
title Rebuild tournament data
call scripts\run_python.bat scripts\tournament_engine.py build
set "tournament_exit=%errorlevel%"
if not "%tournament_exit%"=="0" echo The operation failed. Read the error above before pushing.
pause
exit /b %tournament_exit%
