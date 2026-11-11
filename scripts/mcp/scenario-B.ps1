# D:\Téléchargements\devflow\scripts\mcp\scenario-B.ps1
# Scénario B - Import boutique → Espace commercial
$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$reportsDir = Join-Path $root ".project\reports"
$reportPath = Join-Path $reportsDir "mcp-scenario-B.md"

Write-Host "=== Scénario B - Import boutique → Espace commercial ===" -ForegroundColor Cyan

& "$PSScriptRoot\run-mcp-requests.ps1" `
  -Requests @(
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spaces_space_bulk_import","arguments":{"spaces":[{"name":"Boutique-Demo"}]}}}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"spaces_space_search","arguments":{"query":"Boutique-Demo"}}}',
    '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"spaces://directory"}}'
  ) `
  -ReportPath $reportPath