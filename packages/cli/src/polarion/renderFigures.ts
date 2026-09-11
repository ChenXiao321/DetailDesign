/**
 * 单图渲染：每个带图工作项的 mermaidSrc → 单图渲染页（内嵌 mermaid.min.js + ORTHO 后处理脚本，
 * 与评审报告同一套渲染管线，保证图一致）→ Edge --dump-dom 取渲染后 SVG →
 * 包白底单页 → Edge --screenshot（2x）→ figs/NN_<name>.png。
 * 参照 测试产出 下各模块的 _render.js + svg2png.py 手工管线，移植为 Node 实现。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { wrapFlowchartLabels, pinEndNodeToBottom, mermaidRenderScript } from '@lld/core';

export interface FigureSize { cssWidth: number; cssHeight: number }

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

function execFileAsync(cmd: string, args: string[], maxBuffer = 64 * 1024 * 1024): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(cmd)} 失败(${err.message}): ${stderr.slice(-300)}`));
      else resolve({ stdout, stderr });
    });
  });
}

/** file:// URL 编码（中文路径必须逐段 encodeURIComponent，照抄 _render.js） */
function toFileUrl(p: string): string {
  return 'file:///' + p.replace(/\\/g, '/').replace(/#/g, '%23')
    .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
}

/** 单图渲染页：与评审报告同一套 mermaid 初始化 + ORTHO 后处理 */
function figurePage(mermaidJs: string, mermaidSrc: string): string {
  const src = wrapFlowchartLabels(pinEndNodeToBottom(mermaidSrc))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8">
<style>html,body{margin:0;padding:16px;background:#fff;} .mermaid{display:inline-block;}</style>
</head>
<body>
<div class="mermaid">${src}</div>
<script>${mermaidJs}</script>
${mermaidRenderScript()}
</body>
</html>
`;
}

/** 从渲染后 DOM 抽第一张 SVG 及其 CSS 尺寸 */
function extractSvg(dom: string): { svg: string; cssWidth: number; cssHeight: number } | null {
  const m = /<svg[\s\S]*?<\/svg>/.exec(dom);
  if (!m) return null;
  const tag = /<svg[^>]*>/.exec(m[0])?.[0] ?? '';
  const num = (re: RegExp): number | null => {
    const mm = re.exec(tag);
    return mm ? Number(mm[1]) : null;
  };
  let w = num(/\bwidth="([\d.]+)"/);
  let h = num(/\bheight="([\d.]+)"/);
  if (w == null || h == null) {
    const vb = /viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/.exec(tag);
    if (!vb) return null;
    w = Number(vb[1]); h = Number(vb[2]);
  }
  return { svg: m[0], cssWidth: Math.ceil(w), cssHeight: Math.ceil(h) };
}

export interface RenderFigureItem { figureFile: string; mermaidSrc: string }

/**
 * 批量渲染工作项图片。items 的 figureFile 为相对 polarionOutDir 的路径（figs/NN_x.png）。
 * 返回 figureFile → CSS 尺寸（screenshot 为 2x，docx 显示宽 = cssWidth，限宽由文档侧处理）。
 */
export async function renderFigures(
  items: RenderFigureItem[],
  polarionOutDir: string,
  opts?: { concurrency?: number; mermaidJs?: string },
): Promise<Map<string, FigureSize>> {
  const edge = findEdge();
  const mermaidJs = opts?.mermaidJs ?? fs.readFileSync(
    new URL('../../assets/mermaid.min.js', import.meta.url), 'utf-8');
  const figDir = path.join(polarionOutDir, 'figs');
  fs.mkdirSync(figDir, { recursive: true });
  const tmpDir = path.join(polarionOutDir, 'figs_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const sizes = new Map<string, FigureSize>();
  const concurrency = Math.max(1, opts?.concurrency ?? 3);
  let idx = 0;
  const failures: string[] = [];

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const item = items[idx++]!;
      const base = path.basename(item.figureFile, '.png');
      const pagePath = path.join(tmpDir, `${base}.html`);
      const pngPath = path.join(polarionOutDir, item.figureFile);
      // 1) 渲染页 → dump-dom 取 SVG
      fs.writeFileSync(pagePath, figurePage(mermaidJs, item.mermaidSrc), 'utf-8');
      const { stdout: dom } = await execFileAsync(edge, [
        '--headless', '--disable-gpu', '--dump-dom', '--virtual-time-budget=20000', toFileUrl(pagePath),
      ]);
      const ext = extractSvg(dom);
      if (!ext) { failures.push(`${item.figureFile}（渲染页无 SVG 输出）`); continue; }
      // 2) SVG 包白底单页 → screenshot 2x（照抄 svg2png.py）
      const svgPage = path.join(tmpDir, `${base}_svg.html`);
      fs.writeFileSync(svgPage,
        '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        + '<style>html,body{margin:0;padding:0;background:#fff;}svg{display:block;}</style></head><body>'
        + ext.svg + '</body></html>', 'utf-8');
      await execFileAsync(edge, [
        '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
        `--window-size=${ext.cssWidth},${ext.cssHeight}`,
        `--screenshot=${pngPath}`, toFileUrl(svgPage),
      ]);
      if (!fs.existsSync(pngPath) || fs.statSync(pngPath).size < 500) {
        failures.push(`${item.figureFile}（截图失败或文件过小）`);
        continue;
      }
      sizes.set(item.figureFile, { cssWidth: ext.cssWidth, cssHeight: ext.cssHeight });
      console.error(`  ✓ ${item.figureFile} (${ext.cssWidth}x${ext.cssHeight})`);
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  } finally {
    // 清理中间页（只留 PNG；失败/中断也不留 figs_tmp 垃圾）
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  if (failures.length > 0) {
    throw new Error(`以下图片渲染失败:\n  - ${failures.join('\n  - ')}`);
  }
  return sizes;
}
