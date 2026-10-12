@echo off
setlocal
cd /d "%~dp0"
title Tournament companion site preview
set "companion_python=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%companion_python%" goto bundled_python
call scripts\run_python.bat scripts\companion_preview.py
goto finished
:bundled_python
"%companion_python%" scripts\companion_preview.py
:finished
set "companion_exit=%errorlevel%"
if not "%companion_exit%"=="0" pause
exit /b %companion_exit%
