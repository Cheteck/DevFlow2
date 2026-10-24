# D:\Téléchargements\devflow\scripts\mcp\run-test-suite.ps1
# Pipeline MCP complet - orchestration de tous les scénarios
$ErrorActionPreference = "Stop"

Write-Host "=== Lancement du pipeline MCP complet ===" -ForegroundColor Cyan
Write-Host ""

# 1. Audit initial
Write-Host "[1/5] Audit & Cartographie" -ForegroundColor Yellow
& "$PSScriptRoot\phase1-audit.ps1"

# 2. Scénarios fonctionnels
Write-Host ""
Write-Host "[2/5] Scénario A - Publication produit → Offre" -ForegroundColor Yellow
& "$PSScriptRoot\scenario-A.ps1"

Write-Host ""
Write-Host "[3/5] Scénario B - Import boutique → Espace" -ForegroundColor Yellow
& "$PSScriptRoot\scenario-B.ps1"

Write-Host ""
Write-Host "[4/5] Scénario C - Workflow vendeur (onboarding)" -ForegroundColor Yellow
& "$PSScriptRoot\scenario-C.ps1"

# 3. Analyses d'intelligence
Write-Host ""
Write-Host "[5/5] Analyse d'intelligence" -ForegroundColor Yellow
& "$PSScriptRoot\intelligence-analysis.ps1"

Write-Host ""
Write-Host "=== Pipeline terminé ===" -ForegroundColor Green
Write-Host "Tous les rapports sont dans .project\reports" -ForegroundColor Green