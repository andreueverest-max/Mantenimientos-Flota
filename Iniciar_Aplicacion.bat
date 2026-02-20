@echo off
setlocal
echo ======================================================
echo   INICIANDO APLICACION DE GESTION DE MANTENIMIENTO
echo ======================================================
echo.

:: Comprobar si existe la carpeta de componentes
if not exist node_modules (
    echo Instalando componentes necesarios por primera vez...
    echo Esto puede tardar un par de minutos...
    cmd /c "npm install"
)

:: Doble comprobacion de Vite
if not exist node_modules\.bin\vite.cmd (
    echo Detectada instalacion incompleta. Reparando...
    cmd /c "npm install"
)

echo.
echo Abriendo la aplicacion...
echo Acceso local: http://localhost:5173
echo.
echo Para acceder desde otro ordenador de la red:
echo 1. Abre el menu de inicio y escribe 'cmd'
echo 2. Escribe 'ipconfig' y busca 'Direccion IPv4'
echo 3. En el otro terminal, escribe esa IP seguida de :5173
echo    (Ejemplo: http://192.168.1.50:5173)
echo.

:: Esperar un momento antes de abrir el navegador para dar tiempo a Vite
start "" "http://localhost:5173"
cmd /c "npm run dev"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: No se pudo arrancar la aplicacion. 
    echo Intenta ejecutar: npm install --force
    pause
)

endlocal
