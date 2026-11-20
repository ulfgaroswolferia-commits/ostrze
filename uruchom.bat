@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Uruchamianie Ostrze 2.5D (Voided: na przekor gwiazdom) z paczki /dist/...
if not exist "dist\index.html" (
    echo Brak zbudowanej paczki w /dist/ - uruchamiam budowanie...
    call npm run build
    if errorlevel 1 (
        echo.
        echo Wystapil blad podczas budowania paczki.
        pause
        exit /b 1
    )
)
echo Przegladarka otworzy sie automatycznie pod adresem http://localhost:5174
echo Nie zamykaj tego okna podczas dzialania gry.
echo.
call npm run preview -- --port 5174 --open
if errorlevel 1 (
    echo.
    echo Wystapil blad podczas uruchamiania. Sprawdz czy Node.js i zaleznosci npm sa zainstalowane.
    pause
)
