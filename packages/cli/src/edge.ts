/**
 * 无头浏览器探测（Edge/Chrome 均可）：LLD_EDGE_PATH 环境变量 > Program Files 候选。
 * audit 预渲染（mermaid→SVG 成品版报告）依赖此探测。
 */
import * as fs from 'node:fs';

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
