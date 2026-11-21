@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Ostrze 2.5D - launcher

where node >nul 2>nul
if errorlevel 1 (
    echo Nie znaleziono Node.js. Zainstaluj Node.js LTS i uruchom ten plik ponownie.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo Nie znaleziono npm. Zainstaluj Node.js LTS z npm i uruchom ten plik ponownie.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo Brak zaleznosci projektu. Uruchom w tym katalogu polecenie: npm ci
    pause
    exit /b 1
)

echo Budowanie gry produkcyjnej do katalogu dist...
call npm run build
if errorlevel 1 (
    echo.
    echo Budowanie nie powiodlo sie. Gra nie zostala uruchomiona.
    pause
    exit /b 1
)

echo.
echo Paczka serwerowa jest gotowa w katalogu dist.
echo Lokalny podglad: http://127.0.0.1:5174
echo Nie zamykaj tego okna podczas gry.
echo.
call npm run preview -- --host 127.0.0.1 --port 5174 --strictPort --open
if errorlevel 1 (
    echo.
    echo Nie udalo sie uruchomic podgladu. Sprawdz, czy port 5174 jest wolny.
    pause
    exit /b 1
)

endlocal
