/**
 * 无头浏览器探测（Edge/Chrome 均可）：LLD_EDGE_PATH 环境变量 > Program Files 候选。
 * audit 预渲染（mermaid→SVG 成品版报告）与 images PNG 物化依赖此探测。
 */
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const EDGE_CANDIDATES = [
  String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
  String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
  // Chrome 同为 Chromium 内核，headless 参数（--dump-dom/--screenshot/--print-to-pdf）完全一致
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
];

/** 无头浏览器探测（Edge/Chrome 均可）：LLD_EDGE_PATH 环境变量 > Program Files 候选 */
export function findEdge(): string {
  const env = process.env.LLD_EDGE_PATH;
  if (env) {
    if (fs.existsSync(env)) return env;
    throw new Error(`LLD_EDGE_PATH 指向的浏览器不存在: ${env}\n  排查：路径是否含引号/拼写错误；或 unset 后让程序自动探测 Program Files`);
  }
  for (const c of EDGE_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Edge/Chrome 浏览器。请安装其一，或设置环境变量 LLD_EDGE_PATH 指向 msedge.exe/chrome.exe 完整路径');
}

/** file:// URL 编码（中文路径必须逐段 encodeURIComponent，照抄 _render.js） */
export function toFileUrl(p: string): string {
  return 'file:///' + p.replace(/\\/g, '/').replace(/#/g, '%23')
    .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
}

/** Edge 无头渲染取 JS 执行后 DOM（mermaid + 正交化脚本已跑完） */
export function edgeDump(edge: string, htmlPath: string): string {
  // stderr 不继承（Edge 无头模式噪音多：libpng/同步组件报错等），失败时取尾部打印
  try {
    return execFileSync(edge, ['--headless', '--disable-gpu', '--dump-dom',
      '--virtual-time-budget=20000', toFileUrl(htmlPath)],
      { maxBuffer: 64 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf-8');
  } catch (err) {
    const e = err as { message: string; stderr?: Buffer };
    const tail = e.stderr ? e.stderr.toString('utf-8').slice(-300) : '';
    throw new Error(`无头浏览器渲染失败（${e.message}）${tail ? ': ' + tail : ''}\n  排查：Edge/Chrome 是否可正常运行；路径含特殊字符时可把产物目录换到纯英文路径再试`);
  }
}

/** Edge 无头截图：htmlPath 页面按 winW×winH css px 视口、scale 设备像素比出 PNG 到 pngPath */
export function edgeScreenshot(edge: string, htmlPath: string, pngPath: string,
  winW: number, winH: number, scale: number): void {
  try {
    execFileSync(edge, ['--headless', '--disable-gpu',
      `--screenshot=${pngPath}`, `--window-size=${winW},${winH}`,
      `--force-device-scale-factor=${scale}`, '--hide-scrollbars',
      '--default-background-color=FFFFFFFF', toFileUrl(htmlPath)],
      { maxBuffer: 64 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const e = err as { message: string; stderr?: Buffer };
    const tail = e.stderr ? e.stderr.toString('utf-8').slice(-300) : '';
    throw new Error(`无头浏览器截图失败（${e.message}）${tail ? ': ' + tail : ''}`);
  }
}
