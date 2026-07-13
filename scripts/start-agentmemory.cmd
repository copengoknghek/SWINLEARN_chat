@echo off
setlocal
REM Swinlearn agentmemory (Docker iii-engine + host worker)
REM Requires: Docker Desktop running
set CI=1
set AGENTMEMORY_USE_DOCKER=0

cd /d "%~dp0.."

echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker Desktop is not running.
  exit /b 1
)

echo Starting agentmemory iii-engine via docker-compose.agentmemory.yml...
docker compose -f docker-compose.agentmemory.yml up -d agentmemory-iii-engine
if errorlevel 1 (
  echo ERROR: docker compose failed. If port 3111 is in use, stop the old container:
  echo   docker compose -f docker-compose.agentmemory.yml down
  echo   docker rm -f swinlearn-agentmemory-agentmemory-iii-engine-1 2^>nul
  exit /b 1
)

echo Waiting for iii-engine on :3111...
set /a tries=0
:wait_loop
curl.exe -s -o NUL http://127.0.0.1:3111/
if not errorlevel 1 goto engine_ready
set /a tries+=1
if %tries% geq 30 (
  echo ERROR: iii-engine did not become ready. Check: docker compose -f docker-compose.agentmemory.yml logs agentmemory-iii-engine
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_loop

:engine_ready
echo iii-engine ready.
echo Starting agentmemory worker (REST :3111/agentmemory/*, viewer :3113)...
echo Keep this window open while coding. Ctrl+C to stop the worker only.
echo Stop engine: docker compose -f docker-compose.agentmemory.yml down
npx -y @agentmemory/agentmemory
