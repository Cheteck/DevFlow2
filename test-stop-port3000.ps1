# Test d'arrêt propre du serveur sur le port 3000
# Lance tsx src/start.ts, attend que le port soit ouvert,
# puis tue le processus et vérifie que le port est libéré.

$ErrorActionPreference = "Stop"

# Lancer tsx src/start.ts
$tsxPath = Resolve-Path "node_modules/.bin/tsx.cmd"
$p = Start-Process $tsxPath -ArgumentList "src/start.ts" -PassThru -RedirectStandardOutput "$env:TEMP\tsx_stdout.txt" -RedirectStandardError "$env:TEMP\tsx_stderr.txt" -WindowStyle Hidden

Write-Host "PID tsx: $($p.Id)"

# Attendre que le port 3000 soit ouvert (max 30s)
$portOpen = $false
for ($i = 0; $i -lt 30; $i++) {
    $test = Test-NetConnection -ComputerName localhost -Port 3000 -ErrorAction SilentlyContinue
    if ($test.TcpTestSucceeded) {
        $portOpen = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $portOpen) {
    Write-Host "ERREUR: Port 3000 pas ouvert après 30s"
    Get-Content "$env:TEMP\tsx_stderr.txt" -Tail 20
    exit 1
}

Write-Host "Port 3000 ouvert avec succes"

# Tuer le processus (simule ce que fait notre nouveau code)
Stop-Process -Id $p.Id -Force

# Attendre un peu
Start-Sleep -Seconds 5

# Vérifier que le port est libéré
$test2 = Test-NetConnection -ComputerName localhost -Port 3000 -ErrorAction SilentlyContinue
if ($test2.TcpTestSucceeded) {
    Write-Host "ERREUR: Port 3000 encore ouvert après arret!"
    exit 1
} else {
    Write-Host "SUCCES: Port 3000 libere après arret"
}

Write-Host "=== STDERR ==="
Get-Content "$env:TEMP\tsx_stderr.txt" -Tail 20
exit 0