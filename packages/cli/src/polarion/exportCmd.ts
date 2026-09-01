/**
 * polarion export 编排：lld_design.json → collect → 渲染工作项图片 →
 * 工作项导入文档 HTML → pandoc 转 docx → manifest csv → 打印汇总与导入操作说明。
 * 全部产物写入 <out>/polarion/ 子目录，与既有 figs/ 和交付件互不覆写。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectWorkItems, renderWorkItemsDocument, renderManifestCsv,
  type ModuleModel, type PolarionConfig,
} from '@lld/core';
import { renderFigures } from './renderFigures.js';
import { runPandoc } from './pandoc.js';

function loadModel(outDir: string): ModuleModel {
  const designPath = path.join(outDir, 'lld_design.json');
  const modelPath = path.join(outDir, 'lld_model.json');
  const sourcePath = fs.existsSync(designPath) ? designPath : modelPath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`未找到 ${designPath}，请先运行 analyze（和 gen）`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as ModuleModel;
}

export async function cmdPolarionExport(outDir: string, cfg: PolarionConfig): Promise<void> {
  const model = loadModel(outDir);
  const drafts = collectWorkItems(model, cfg);
  const polarionDir = path.join(outDir, 'polarion');
  fs.mkdirSync(polarionDir, { recursive: true });

  // 1) 渲染带图工作项的 PNG（Edge 无头，与报告同一渲染管线）
  const figItems = drafts.filter(d => d.mermaidSrc && d.figureFile)
    .map(d => ({ figureFile: d.figureFile!, mermaidSrc: d.mermaidSrc! }));
  console.error(`渲染工作项图片 ${figItems.length} 张（Edge 无头，并发 3）…`);
  const sizes = await renderFigures(figItems, polarionDir);

  // 2) 工作项导入文档 HTML → pandoc → docx
  const html = renderWorkItemsDocument(model, drafts, cfg, {
    figureWidths: new Map([...sizes].map(([k, v]) => [k, v.cssWidth])),
    maxImageWidthPx: cfg.maxImageWidthPx,
  });
  const htmlPath = path.join(polarionDir, 'polarion_workitems.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  const docxPath = path.join(polarionDir, 'polarion_workitems.docx');
  const referenceDoc = path.join(outDir, 'reference.docx');
  runPandoc(htmlPath, docxPath, fs.existsSync(referenceDoc) ? referenceDoc : undefined);

  // 3) manifest csv（UTF-8 BOM，Excel/Polarion 侧直接可读）
  const manifestPath = path.join(polarionDir, 'polarion_manifest.csv');
  fs.writeFileSync(manifestPath, '\uFEFF' + renderManifestCsv(drafts), 'utf-8');

  // 4) 汇总 + 导入操作说明
  const byChapter = new Map<string, number>();
  for (const d of drafts) byChapter.set(d.chapter, (byChapter.get(d.chapter) ?? 0) + 1);
  console.log(`\n工作项 ${drafts.length} 个（带图 ${figItems.length} 个）:`);
  for (const [c, n] of byChapter) console.log(`  ${c}: ${n}`);
  console.log(`\n产物（${polarionDir}）:`);
  console.log(`  polarion_workitems.docx   Word round-trip 导入文件（H2=工作项边界，共 ${drafts.length} 个）`);
  console.log(`  polarion_workitems.html   同内容 HTML（核对用）`);
  console.log(`  polarion_manifest.csv     工作项清单（key/title/图/ID 回写闭环）`);
  console.log(`  figs/                     工作项内嵌图片 ${figItems.length} 张`);
  console.log(`
Polarion 导入操作（Word round-trip）:
  1. Polarion 项目 ${cfg.projectId || '(未配置 projectId)'} → Work Items → Import → Word
  2. 选择 polarion_workitems.docx，"Split document at" 设为 Heading 2
  3. 类型映射建议（H2 前缀即 kind）:
${Object.entries(cfg.workItemTypes).map(([k, v]) => `     [${v}] ← ${k}`).join('\n')}
  4. 导入后从 Polarion 导出工作项 csv（需含 ID 与 Description 列），回本目录执行:
     node packages/cli/dist/index.js polarion <模块目录> --out ${path.relative(process.cwd(), outDir) || '.'} map-ids --ids <导出csv>`);
}
