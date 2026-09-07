@echo off
setlocal
cd /d "%~dp0.."
echo Stopping agentmemory Docker stack...
docker compose -f docker-compose.agentmemory.yml down
echo Done.
