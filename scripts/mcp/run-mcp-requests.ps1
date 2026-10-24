# D:\Téléchargements\devflow\scripts\mcp\run-mcp-requests.ps1
# Helper : lance le serveur MCP (stdio) et injecte des requetes JSON-RPC.
# Usage : .\run-mcp-requests.ps1 -Requests @('{"jsonrpc":...}') -ReportPath "path\to\report.md"
param(
  [Parameter(Mandatory)]
  [string[]]$Requests,

  [Parameter(Mandatory)]
  [string]$ReportPath
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$reportsDir = Split-Path $ReportPath -Parent
if (!(Test-Path $reportsDir)) {
  New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/d /c pnpm --filter @mosaix/mcp run stdio"
$psi.WorkingDirectory = (Join-Path $root "packages\mcp")
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi

$errLines = New-Object System.Collections.Generic.List[string]
$errScript = {
  param($sender, $e)
  if ($e.Data -ne $null) { $args[2].Add($e.Data) }
}
# Attach event with ScriptBlock using Register-ObjectEvent or simple sync read after Wait
# PowerShell 5.1 approach: sync read stdout/stderr using asynchronous tasks or simple output redirect
$process.Start() | Out-Null

$stdin = $process.StandardInput
foreach ($line in $Requests) {
  $stdin.WriteLine($line)
}
$stdin.Flush()
$stdin.Close()

$output = $process.StandardOutput.ReadToEnd()
$errorOutput = $process.StandardError.ReadToEnd()
$process.WaitForExit()
$exitCode = $process.ExitCode
$process.Dispose()

if ($exitCode -ne 0) {
  Write-Host "[WARN] MCP server exited with code $exitCode" -ForegroundColor Yellow
}

if (Test-Path $ReportPath) { Remove-Item $ReportPath -Force }

$header = New-Object System.Text.StringBuilder
[void]$header.AppendLine("# MCP Report - " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
[void]$header.AppendLine("")
[void]$header.AppendLine("## Requests sent")
[void]$header.AppendLine("")
foreach ($line in $Requests) {
  [void]$header.AppendLine("  " + $line)
}
[void]$header.AppendLine("")
[void]$header.AppendLine("## Server responses (raw, one JSON-RPC line each)")
[void]$header.AppendLine("")
$header.ToString() | Out-File -FilePath $ReportPath -Encoding utf8
$output | Out-File -FilePath $ReportPath -Append -Encoding utf8

if ($errorOutput -and $errorOutput.Trim().Length -gt 0) {
  $stderrBlock = New-Object System.Text.StringBuilder
  [void]$stderrBlock.AppendLine("")
  [void]$stderrBlock.AppendLine("## STDERR (server diagnostics)")
  [void]$stderrBlock.AppendLine("")
  [void]$stderrBlock.AppendLine($errorOutput)
  $stderrBlock.ToString() | Out-File -FilePath $ReportPath -Append -Encoding utf8
}

Write-Host "[OK] Report generated -> $ReportPath" -ForegroundColor Green