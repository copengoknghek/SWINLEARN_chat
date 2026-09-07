@echo off
setlocal
REM Fix stale Docker networks/containers ("network ... not found" in Docker Desktop).
REM Removes old containers and recreates the swinlearn stack from scratch.

cd /d "%~dp0.."

echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker Desktop is not running.
  exit /b 1
)

echo Removing stale swinlearn containers and networks...
docker compose down --remove-orphans
if errorlevel 1 exit /b 1

echo Recreating stack...
docker compose up -d --build
if errorlevel 1 exit /b 1

echo.
echo Repair complete. Open http://localhost:5173
echo Logs: npm run dev:logs
