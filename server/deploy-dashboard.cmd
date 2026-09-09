@echo off
setlocal

set "REPO_DIR=%~dp0.."
set "LOG_FILE=%REPO_DIR%\server\deploy-dashboard.last.log"
set "BASH_EXE="

if exist "C:\Program Files\Git\bin\bash.exe" set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
if not defined BASH_EXE if exist "C:\Program Files\Git\usr\bin\bash.exe" set "BASH_EXE=C:\Program Files\Git\usr\bin\bash.exe"

if not defined BASH_EXE (
  echo [ERROR] Git Bash not found.
  echo Install Git for Windows or run server\deploy-dashboard.sh from WSL.
  if /I not "%~1"=="--no-pause" pause
  exit /b 1
)

pushd "%REPO_DIR%" >nul
echo Running deployment... output will also be saved to:
echo   %LOG_FILE%
echo.

"%BASH_EXE%" "server/deploy-dashboard.sh" > "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

type "%LOG_FILE%"
echo.
if "%EXIT_CODE%"=="0" (
  echo [OK] Deployment finished.
) else (
  echo [ERROR] Deployment failed with exit code %EXIT_CODE%.
)

popd >nul
if /I not "%~1"=="--no-pause" pause
exit /b %EXIT_CODE%

