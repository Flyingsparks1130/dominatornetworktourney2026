@echo off
setlocal
cd /d "%~dp0"
title Record Dominion vs Dominarium
call scripts\run_python.bat scripts\apply_lhncfl.py
set "tournament_exit=%errorlevel%"
if not "%tournament_exit%"=="0" echo The result was not applied. Read the error above before pushing.
pause
exit /b %tournament_exit%
