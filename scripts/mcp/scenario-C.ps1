# D:\Téléchargements\devflow\scripts\mcp\scenario-C.ps1
# Scénario C - Workflow complet vendeur (onboarding)
$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$reportsDir = Join-Path $root ".project\reports"
$reportPath = Join-Path $reportsDir "mcp-scenario-C.md"

Write-Host "=== Scénario C - Workflow complet vendeur (onboarding) ===" -ForegroundColor Cyan

& "$PSScriptRoot\run-mcp-requests.ps1" `
  -Requests @(
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mosaix_create_business_space","arguments":{"spaceName":"Vendeur-Demo","ownerUserId":"user-001","announcementText":"Bienvenue dans la boutique Vendeur-Demo !"}}}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"portfolio_vendable_propose","arguments":{"reference":"REF-VENDEUR-001","name":"Produit-Vendeur","description":"Produit du vendeur"}}}',
    '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"commerce_offer_create","arguments":{"sellerId":"seller-001","vendableId":"vendable-vendeur","title":"Offre Vendeur","priceInCents":2999}}}'
  ) `
  -ReportPath $reportPath