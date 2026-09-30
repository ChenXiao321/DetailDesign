/**
 * gen --only images：图 PNG 物化。把 lld_design.json 里全部六类 mermaid 图
 * （函数流程图/功能接口总图/内部调用图/状态机/序列图/4.2 包含关系图）渲染成 PNG
 * 以 base64 存回 design json（*Png 字段），json 归档即含成品图，不依赖浏览器再渲染。
 *
 * 渲染管线与已验收报告严格一致：core/imageBatch 拼批量页（报告同款 CSS + 内嵌
 * mermaid.min.js + 正交化后处理脚本）→ Edge --dump-dom 一次取全部渲染后 SVG →
 * 逐图独立页 Edge --screenshot 出 PNG（默认 2x，超大图自动降 scale 避开 Edge 纹理上限）。
 * 免 LLM；--resume 跳过已有 PNG 的图；单图失败不中断，末尾点名，可续跑补齐。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectDiagrams, buildBatchPage, extractDiagramSvgs, svgNaturalSize, pickShotParams,
  wrapSvgShotPage, hasDiagramPng, applyDiagramPng, syncSmAliasPng, lintModelSchema,
  type ModuleModel,
} from '@lld/core';
import { findEdge, edgeDump, edgeScreenshot } from './edge.js';

/** 成品口径结构自检（0930 冻结 v1）：全字段+全 PNG 在场，缺陷即非零退出 */
function lintOrFail(model: ModuleModel): void {
  const problems = lintModelSchema(model, { requirePngs: true, requireDocument: true, requireDynamic: true });
  if (problems.length > 0) {
    console.log(`\n✗ 结构完整性自检 ${problems.length} 项缺失:`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
}

export async function cmdImages(outDir: string, resume: boolean): Promise<void> {
  const designPath = path.join(outDir, 'lld_design.json');
  if (!fs.existsSync(designPath)) {
    console.error(`未找到 ${designPath}，请先运行 analyze 和 gen`);
    process.exit(1);
  }
  const model = JSON.parse(fs.readFileSync(designPath, 'utf-8')) as ModuleModel;
  // 存量多核 json 自愈：旧版 images 只写 stateMachines[]，兼容别名 stateMachine 缺 PNG
  if (syncSmAliasPng(model)) {
    fs.writeFileSync(designPath, JSON.stringify(model, null, 2), 'utf-8');
    console.error('  兼容别名 stateMachine.diagramPng 已从 stateMachines[0] 同步');
  }

  const mermaidPath = new URL('../assets/mermaid.min.js', import.meta.url);
  if (!fs.existsSync(mermaidPath)) {
    console.error('未找到 mermaid.min.js（packages/cli/assets），无法渲染图');
    process.exit(1);
  }
  const mermaidJs = fs.readFileSync(mermaidPath, 'utf-8');
  const edge = findEdge();

  const all = collectDiagrams(model);
  const todo = resume ? all.filter(e => !hasDiagramPng(model, e.key)) : all;
  if (todo.length === 0) {
    lintOrFail(model);   // 无事可做也按成品口径验一遍（存量 json 可能缺 document 等字段）
    console.log(`全部 ${all.length} 张图均已有 PNG，无需处理（不加 --resume 可强制重渲）`);
    return;
  }
  console.log(`图 PNG 物化: 共 ${all.length} 张，本次处理 ${todo.length} 张${resume ? '（--resume 跳过已有）' : ''}`);

  const save = (): void => {
    fs.writeFileSync(designPath, JSON.stringify(model, null, 2), 'utf-8');
  };

  // ① 批量页一次渲染（与报告同管线），取全部 SVG
  const batchPath = path.join(outDir, '_lldimg_batch.html');
  fs.writeFileSync(batchPath, buildBatchPage(todo, mermaidJs), 'utf-8');
  console.error('  Edge 批量渲染中（mermaid + 正交化，同报告管线）...');
  const dump = edgeDump(edge, batchPath);
  const { svgs, failed } = extractDiagramSvgs(dump, todo);
  const failures: string[] = failed.map(k => `${k}（mermaid 渲染失败/语法错误）`);
  if (svgs.size === 0) {
    try { fs.unlinkSync(batchPath); } catch { /* 忽略 */ }
    console.error('⚠ 批量渲染未取到任何 SVG，批量页已保留排查: ' + batchPath);
    // 保留批量页便于排查
    fs.writeFileSync(batchPath, buildBatchPage(todo, mermaidJs), 'utf-8');
    process.exit(1);
  }

  // ② 逐图截图出 PNG
  const shotHtml = path.join(outDir, '_lldimg_shot.html');
  const shotPng = path.join(outDir, '_lldimg_shot.png');
  let done = 0;
  let doneBytes = 0;
  for (const e of todo) {
    const svg = svgs.get(e.key);
    if (!svg) continue;
    try {
      const size = svgNaturalSize(svg);
      if (!size) throw new Error('SVG 无 viewBox/尺寸');
      const { scale, winW, winH } = pickShotParams(size.w, size.h);
      fs.writeFileSync(shotHtml, wrapSvgShotPage(svg), 'utf-8');
      edgeScreenshot(edge, shotHtml, shotPng, winW, winH, scale);
      const buf = fs.readFileSync(shotPng);
      if (buf.length < 100) throw new Error('截图产物异常（过小）');
      const applyErr = applyDiagramPng(model, e.key, buf.toString('base64'));
      if (applyErr) throw new Error(applyErr);
      done++;
      doneBytes += buf.length;
      if (done % 5 === 0 || done === svgs.size) save();   // 增量落盘，中断可续
      console.error(`  [${done}/${svgs.size}] ${e.kind} ${e.title}（${winW}×${winH} @${scale}x，${(buf.length / 1024).toFixed(0)}KB）`);
    } catch (err) {
      failures.push(`${e.key}（${(err as Error).message}）`);
    }
  }
  save();

  // 结构完整性自检（0930 冻结 v1）：images 是成品前最后一站，要求全字段+全 PNG 在场
  lintOrFail(model);

  // 清理临时文件
  for (const p of [batchPath, shotHtml, shotPng]) { try { fs.unlinkSync(p); } catch { /* 忽略 */ } }

  console.log(`\nPNG 物化完成: ${done}/${todo.length} 张（共 ${(doneBytes / 1024 / 1024).toFixed(1)}MB base64 前）`);
  if (failures.length > 0) {
    console.log(`⚠ ${failures.length} 张失败（加 --resume 可只重试这些）:`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`已写入: ${designPath}`);
}
