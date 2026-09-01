/**
 * pandoc 调用：polarion_workitems.html → polarion_workitems.docx。
 * cwd 设为 HTML 所在目录，相对路径 figs/NN.png 才能被 pandoc 找到并打包进 docx。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const PANDOC_CANDIDATES = [
  String.raw`C:\Program Files\Pandoc\pandoc.exe`,
];

/** pandoc 可执行文件探测：LLD_PANDOC_PATH 环境变量 > Program Files > PATH */
export function findPandoc(): string {
  const env = process.env.LLD_PANDOC_PATH;
  if (env) {
    if (fs.existsSync(env)) return env;
    throw new Error(`LLD_PANDOC_PATH 指向的 pandoc 不存在: ${env}`);
  }
  for (const c of PANDOC_CANDIDATES) if (fs.existsSync(c)) return c;
  try {
    execFileSync('pandoc', ['--version'], { stdio: 'pipe' });
    return 'pandoc';
  } catch { /* not on PATH */ }
  throw new Error('未找到 pandoc。请安装 pandoc，或设置环境变量 LLD_PANDOC_PATH 指向 pandoc.exe 完整路径');
}

/**
 * HTML → docx。referenceDoc 存在时用 --reference-doc 套用 A4/12mm 版心与样式。
 * 失败时报错并打印等价手工命令。
 */
export function runPandoc(htmlPath: string, docxPath: string, referenceDoc?: string): void {
  const pandoc = findPandoc();
  const cwd = path.dirname(htmlPath);
  const args = [path.basename(htmlPath), '-o', path.basename(docxPath)];
  if (referenceDoc && fs.existsSync(referenceDoc)) {
    args.push(`--reference-doc=${referenceDoc}`);
  }
  try {
    execFileSync(pandoc, args, { cwd, stdio: 'pipe' });
  } catch (err) {
    throw new Error(`pandoc 转换失败: ${(err as Error).message}\n`
      + `  等价手工命令（在 ${cwd} 下执行）:\n  ${pandoc} ${args.join(' ')}`);
  }
  if (!fs.existsSync(docxPath)) {
    throw new Error(`pandoc 未产出 ${docxPath}\n  等价手工命令（在 ${cwd} 下执行）:\n  ${pandoc} ${args.join(' ')}`);
  }
}
