/**
 * polarion map-ids 编排：Polarion 导出 csv（含 ID + Description/Title 列）
 * → matchWorkItemIds（锚点 > title）→ 回写 lld_design.json 的 polarion.workItemId。
 * 未匹配默认报错退出（不回写半吊子），--partial 显式放行。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectWorkItems, parsePolarionCsv, matchWorkItemIds, applyWorkItemIds,
  renderManifestCsv, type ModuleModel, type PolarionConfig,
} from '@lld/core';

export function cmdPolarionMapIds(
  outDir: string, cfg: PolarionConfig, idsCsvPath: string | undefined, partial: boolean,
): void {
  if (!idsCsvPath) {
    console.error('缺少 --ids <Polarion导出csv>。请从 Polarion 导出工作项 csv（需含 ID 列，建议含 Description 列）');
    process.exit(1);
  }
  const designPath = path.join(outDir, 'lld_design.json');
  const modelPath = path.join(outDir, 'lld_model.json');
  const sourcePath = fs.existsSync(designPath) ? designPath : modelPath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`未找到 ${designPath}，请先运行 analyze（和 gen）`);
    process.exit(1);
  }
  if (!fs.existsSync(idsCsvPath)) {
    console.error(`Polarion 导出 csv 不存在: ${idsCsvPath}`);
    process.exit(1);
  }

  const model = JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as ModuleModel;
  const drafts = collectWorkItems(model, cfg);
  const rows = parsePolarionCsv(fs.readFileSync(idsCsvPath, 'utf-8'));
  console.error(`Polarion 导出 csv ${rows.length} 行，本地工作项 ${drafts.length} 个`);

  const result = matchWorkItemIds(drafts, rows);
  for (const w of result.warnings) console.error(w);

  if (result.unmatchedKeys.length > 0 && !partial) {
    console.error(`\n✗ ${result.unmatchedKeys.length} 个工作项在导出 csv 中未匹配到（未回写任何内容）:`);
    for (const k of result.unmatchedKeys) console.error(`  - ${k}`);
    console.error('确认后加 --partial 允许部分回写');
    process.exit(1);
  }
  if (result.unmatchedKeys.length > 0) {
    console.error(`\n⚠ --partial 模式：${result.unmatchedKeys.length} 个工作项未匹配，跳过:`);
    for (const k of result.unmatchedKeys) console.error(`  - ${k}`);
  }
  if (result.unmatchedIds.length > 0) {
    console.error(`\n提示：导出 csv 中 ${result.unmatchedIds.length} 个 ID 未匹配到本地工作项（可能是别的项）:`);
    for (const id of result.unmatchedIds) console.error(`  - ${id}`);
  }

  const n = applyWorkItemIds(drafts, result.matches);
  fs.writeFileSync(sourcePath, JSON.stringify(model, null, 2), 'utf-8');
  console.log(`\n✓ 回写 ${n} 个 workItemId → ${sourcePath}`);

  // manifest 闭环：polarion/ 目录已存在则刷新（完整产物仍以重跑 export 为准）
  const polarionDir = path.join(outDir, 'polarion');
  if (fs.existsSync(path.join(polarionDir, 'polarion_manifest.csv'))) {
    fs.writeFileSync(path.join(polarionDir, 'polarion_manifest.csv'),
      '\uFEFF' + renderManifestCsv(drafts), 'utf-8');
    console.log(`✓ 已刷新 ${path.join(polarionDir, 'polarion_manifest.csv')} 的 workItemId 列`);
  }
  console.log('提示：重跑 report 可在评审报告卡片 footer 显示 Polarion ID；重跑 export 可刷新 docx 内的锚点行');
}
