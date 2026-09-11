@echo off
rem Use a supported Python installation without installing anything automatically.
py -3 -c "import sys; sys.exit(sys.version_info < (3, 10))" >nul 2>&1
if not errorlevel 1 goto use_py
python -c "import sys; sys.exit(sys.version_info < (3, 10))" >nul 2>&1
if not errorlevel 1 goto use_python
echo Python 3.10 or newer is required for the local organizer.
echo Install Python from https://www.python.org/downloads/windows/ and enable Add Python to PATH.
echo Then run this launcher again. No repository files have been changed.
exit /b 1
:use_py
py -3 %*
exit /b %errorlevel%
:use_python
python %*
exit /b %errorlevel%
