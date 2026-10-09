@echo off
rem LLD one-shot pipeline: analyze -> gen(resume) -> report -> audit
rem Usage: lld-run.bat <module-dir> [out-dir]
rem   e.g. lld-run.bat 测试模块\Gp_EcuStpStdn 测试产出\Gp_EcuStpStdn
rem Exit code: 0=all green / 1=error or schema check failed / 2=partial LLM failures (report still produced)
rem LLM config: env LLD_LLM_BASE_URL / LLD_LLM_API_KEY / LLD_LLM_MODEL, or lld.config.json beside this bat
setlocal
if "%~1"=="" (
  echo Usage: lld-run.bat ^<module-dir^> [out-dir]
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
