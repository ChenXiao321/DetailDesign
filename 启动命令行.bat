@echo off
rem Open a cmd window with Node on PATH (no global env var needed).
rem Prerequisite: extract node-v22.20.0-win-x64.zip into this directory.
set "LLD_HOME=%~dp0"
if exist "%LLD_HOME%node-v22.20.0-win-x64\node.exe" (
  set "PATH=%LLD_HOME%node-v22.20.0-win-x64;%PATH%"
) else (
  echo [ERROR] not found: %LLD_HOME%node-v22.20.0-win-x64\node.exe
  echo Please extract node-v22.20.0-win-x64.zip into this directory first.
  pause
  exit /b 1
)
cd /d "%LLD_HOME%"
echo Node ready:
node -v
echo.
echo Examples:
echo   node packages\cli\dist\index.js ping
echo   node packages\cli\dist\index.js run ^<module-src-dir^> --out ^<output-dir^>
echo.
cmd /k
