# Phase 1 - Audit & Cartographie MCP (lecture seule)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$reportPath = Join-Path $root ".project\reports\mcp-audit-week1.md"
Write-Host "=== Phase 1 : Audit MCP ===" -ForegroundColor Cyan
& "$PSScriptRoot\run-mcp-requests.ps1" `
  -Requests @(
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}',
    '{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}',
    '{"jsonrpc":"2.0","id":4,"method":"prompts/list","params":{}}',
    '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"platform_get_topology","arguments":{}}}'
  ) `
  -ReportPath $reportPath