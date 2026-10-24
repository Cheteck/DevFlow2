# Scénario A - Publication produit → Offre commerciale
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$reportPath = Join-Path $root ".project\reports\mcp-scenario-A.md"
Write-Host "=== Scénario A - Publication produit → Offre commerciale ===" -ForegroundColor Cyan
& "$PSScriptRoot\run-mcp-requests.ps1" `
  -Requests @(
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"portfolio_vendable_propose","arguments":{"reference":"REF-DEMO-001","name":"Produit Test","description":"Un produit de demonstration"}}}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"commerce_offer_create","arguments":{"sellerId":"seller-001","vendableId":"vendable-001","title":"Offre Test","priceInCents":1999}}}',
    '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"commerce_offer_list","arguments":{"limit":5}}}',
    '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"commerce_check_stock","arguments":{"productId":"prod-test"}}}'
  ) `
  -ReportPath $reportPath