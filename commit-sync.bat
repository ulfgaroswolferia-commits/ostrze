@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" (
    set /p "MSG=Podaj opis commita (lub wcisnij Enter dla domyslnego): "
)

if "%MSG%"=="" (
    node scripts/commit-sync.mjs
) else (
    node scripts/commit-sync.mjs "%MSG%"
)

pause
