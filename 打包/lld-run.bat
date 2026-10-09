@echo off
rem LLD one-shot pipeline: analyze -> gen(resume) -> report -> audit
rem Usage: lld-run.bat <module-dir> [out-dir]
rem   e.g. lld-run.bat modules\Gp_EcuStpStdn out\Gp_EcuStpStdn
rem Exit code: 0=all green / 1=error or schema check failed / 2=partial LLM failures (report still produced)
rem LLM config: env LLD_LLM_BASE_URL / LLD_LLM_API_KEY / LLD_LLM_MODEL, or lld.config.json beside this bat
setlocal
rem auto-detect portable Node beside this bat when node is not on PATH
where node >nul 2>nul
if errorlevel 1 (
  if exist "%~dp0node-v22.20.0-win-x64\node.exe" (
    set "PATH=%~dp0node-v22.20.0-win-x64;%PATH%"
    echo [lld-run] portable Node detected, PATH patched for this run.
  )
)
if "%~1"=="" (
  echo Usage: lld-run.bat ^<module-dir^> [out-dir]
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [lld-run] ERROR: node not found on PATH and no portable Node beside this bat.
  echo Install Node ^>= 18, or extract node-v22.20.0-win-x64.zip next to this bat.
  exit /b 1
)
rem resolve to absolute paths before pushd (caller-relative paths must survive cwd change)
for %%I in ("%~1") do set "MOD=%%~fI"
if "%~2"=="" (set "OUT=%MOD%") else (for %%I in ("%~2") do set "OUT=%%~fI")
pushd "%~dp0"
node "packages\cli\dist\index.js" run "%MOD%" --out "%OUT%"
set "RC=%ERRORLEVEL%"
popd
exit /b %RC%
