@echo off
setlocal
REM Swinlearn full dev stack (mysql, qdrant, ollama, api, web)
REM Requires: Docker Desktop running

cd /d "%~dp0.."

echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker Desktop is not running.
  exit /b 1
)

echo Starting Swinlearn stack...
docker compose up -d --build
if errorlevel 1 exit /b 1

echo.
echo Swinlearn is up:
echo   Web:  http://localhost:5173
echo   API:  http://localhost:3001
echo   MySQL Workbench: localhost:3307
echo.
echo Logs:  npm run dev:logs
echo Stop:  npm run dev:down
