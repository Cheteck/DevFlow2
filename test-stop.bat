@echo off
setlocal enabledelayedexpansion

REM Lancer tsx --watch src/start.ts en arrière-plan
start "tsx_server" /B "node_modules\.bin\tsx.cmd" --watch src/start.ts > "%TEMP%\tsx_stdout.txt" 2> "%TEMP%\tsx_stderr.txt"

REM Trouver le PID de tsx
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq tsx.cmd" /fo table /nh') do set TSX_PID=%%a
echo PID tsx: %TSX_PID%

REM Attendre que le port 3000 soit ouvert (max 30s)
set PORT_OPEN=0
for /l %%i in (1,1,30) do (
    netstat -ano | findstr ":3000" >nul 2>&1
    if !errorlevel! equ 0 (
        set PORT_OPEN=1
        goto :port_open
    )
    timeout /t 1 >nul
)
:port_open
if %PORT_OPEN% equ 0 (
    echo ERREUR: Port 3000 pas ouvert après 30s
    type "%TEMP%\tsx_stderr.txt"
    exit /b 1
)

echo Port 3000 ouvert avec succes

REM Tuer le processus tsx et tout son arbre (simule ce que fait notre nouveau code)
taskkill /PID %TSX_PID% /T /F

REM Attendre
timeout /t 5 >nul

REM Vérifier que le port est libéré
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ERREUR: Port 3000 encore ouvert après arret!
    exit /b 1
) else (
    echo SUCCES: Port 3000 libere après arret
)

echo === STDERR ===
type "%TEMP%\tsx_stderr.txt"
exit /b 0