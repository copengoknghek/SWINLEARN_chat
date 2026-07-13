@echo off
setlocal
cd /d "%~dp0.."
echo Stopping agentmemory Docker stack...
docker compose --profile agentmemory down
echo Done.
