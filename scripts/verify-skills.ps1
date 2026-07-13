# Swinlearn skill stack health check
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "`n=== Skill stack verification ===" -ForegroundColor Cyan

# 1. Project skills (.agents)
$agentSkills = @(Get-ChildItem ".agents\skills" -Directory -ErrorAction SilentlyContinue).Count
Write-Host "[skills] .agents/skills: $agentSkills directories" $(if ($agentSkills -ge 30) { "OK" } else { "WARN" })

# 2. Cursor-only skills
$cursorSkills = @(
  (Test-Path ".cursor\skills\ui-ux-pro-max\SKILL.md"),
  (Test-Path ".cursor\skills\graphify\SKILL.md")
)
Write-Host "[skills] ui-ux-pro-max + graphify in .cursor/skills:" $(if ($cursorSkills -notcontains $false) { "OK" } else { "FAIL" })

# 3. Orchestration rules
$rules = @(
  (Test-Path ".cursor\rules\skills-orchestration.mdc"),
  (Test-Path ".cursor\rules\graphify.mdc")
)
Write-Host "[rules] orchestration + graphify:" $(if ($rules -notcontains $false) { "OK" } else { "FAIL" })

# 4. Design system
Write-Host "[ui-ux] design-system/swinlearn/MASTER.md:" $(if (Test-Path "design-system\swinlearn\MASTER.md") { "OK" } else { "MISSING (run ui-ux-pro-max --persist)" })

# 5. Graphify
try {
  $gv = graphify --version 2>&1
  Write-Host "[graphify] CLI: $gv OK"
  if (Test-Path "graphify-out\graph.json") { Write-Host "[graphify] graph.json: OK" } else { Write-Host "[graphify] graph.json: MISSING (run: graphify .)" -ForegroundColor Yellow }
} catch {
  Write-Host "[graphify] CLI: FAIL" -ForegroundColor Red
}

# 6. ui-ux-pro-max Python search
try {
  python ".cursor\skills\ui-ux-pro-max\scripts\search.py" "test" --domain product --max-results 1 | Out-Null
  Write-Host "[ui-ux-pro-max] Python search: OK"
} catch {
  Write-Host "[ui-ux-pro-max] Python search: FAIL" -ForegroundColor Red
}

# 7. Agentmemory (project Docker Compose profile + running worker)
$docker = docker ps --filter "name=swinlearn-agentmemory-iii-engine" --format "{{.Names}}" 2>$null
if (-not $docker) {
  $docker = docker ps --filter "name=agentmemory-iii-engine" --format "{{.Names}}" 2>$null
}
if ($docker) {
  Write-Host "[agentmemory] iii-engine container: OK ($docker)"
} else {
  Write-Host "[agentmemory] iii-engine container: NOT RUNNING" -ForegroundColor Yellow
  Write-Host "  Start: docker compose --profile agentmemory up -d"
  Write-Host "  Or:    scripts\start-agentmemory.cmd"
}

try {
  $health = Invoke-RestMethod -Uri "http://localhost:3111/agentmemory/health" -TimeoutSec 5
  if ($health.status -eq "healthy") {
    Write-Host "[agentmemory] REST API: healthy v$($health.version)"
    $body = '{"content":"verify-skills probe","concepts":["install-check"]}'
    Invoke-RestMethod -Uri "http://localhost:3111/agentmemory/remember" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
    Write-Host "[agentmemory] remember endpoint: OK"
  } else {
    Write-Host "[agentmemory] REST API: unhealthy" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[agentmemory] REST API: OFFLINE (run scripts\start-agentmemory.cmd)" -ForegroundColor Yellow
}

# 8. Cursor MCP config
$mcpPath = Join-Path $env:USERPROFILE ".cursor\mcp.json"
if (Test-Path $mcpPath) {
  $mcp = Get-Content $mcpPath -Raw | ConvertFrom-Json
  if ($mcp.mcpServers.agentmemory) { Write-Host "[mcp] ~/.cursor/mcp.json agentmemory: OK" }
  else { Write-Host "[mcp] agentmemory entry missing in ~/.cursor/mcp.json" -ForegroundColor Yellow }
} else {
  Write-Host "[mcp] ~/.cursor/mcp.json: MISSING" -ForegroundColor Yellow
}

Write-Host "`nManual: install Superpowers plugin in Cursor chat -> /add-plugin superpowers" -ForegroundColor DarkGray
Write-Host "Done.`n"
