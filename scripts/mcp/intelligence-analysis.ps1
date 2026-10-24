# D:\Téléchargements\devflow\scripts\mcp\intelligence-analysis.ps1
# Analyse d'intelligence (qualité, modération, classification)
$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$reportsDir = Join-Path $root ".project\reports"
$reportPath = Join-Path $reportsDir "mcp-intelligence.md"

Write-Host "=== Analyse d'intelligence (qualité, modération, classification) ===" -ForegroundColor Cyan

& "$PSScriptRoot\run-mcp-requests.ps1" `
  -Requests @(
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"portfolio_listing_quality_score","arguments":{"reference":"REF-DEMO-001","title":"Produit Test"}}}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"spaces_content_moderate","arguments":{"text":"Test de moderation"}}}',
    '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"commerce_product_classify","arguments":{"title":"Produit Test"}}}'
  ) `
  -ReportPath $reportPath