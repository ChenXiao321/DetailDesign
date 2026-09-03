@echo off
rem 启动一个已配好 Node 路径的命令行窗口（免配全局环境变量）
rem 前提：node-v22.20.0-win-x64.zip 解压在本目录下
set "LLD_HOME=%~dp0"
if exist "%LLD_HOME%node-v22.20.0-win-x64\node.exe" (
  set "PATH=%LLD_HOME%node-v22.20.0-win-x64;%PATH%"
) else (
  echo [提示] 未找到 %LLD_HOME%node-v22.20.0-win-x64\node.exe
  echo 请把 node-v22.20.0-win-x64.zip 解压到本目录后再双击本脚本。
  pause
  exit /b 1
)
cd /d "%LLD_HOME%"
echo Node 已就绪：
node -v
echo.
echo 可直接运行，例如：
echo   node packages\cli\dist\index.js ping
echo   node packages\cli\dist\index.js analyze 测试模块\Gp_EcuStpStdn --out 测试产出\Gp_EcuStpStdn_qwen
echo.
cmd /k
