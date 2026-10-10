#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeModule, generateDesign, generateHtmlReport, resolveConfig, normalizeBaseUrl,
  OpenAICompatibleProvider, MockProvider, lintModelSchema,
  diffModules, applyModuleDiff, buildPolarionSync,
  type InputFile, type ModuleModel, type LLMProvider, type ModuleDiff, type PolarionSync,
} from '@lld/core';
import { cmdAudit } from './audit.js';
import { cmdImages } from './images.js';
import { loadConfigFile, resolveAbbreviations, abbrGapLogger } from './config.js';

function collectCFiles(dir: string, base: string, out: InputFile[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCFiles(full, base, out);
    } else if (/\.[ch]$/i.test(entry.name)) {
      out.push({ path: path.relative(base, full), content: fs.readFileSync(full, 'utf-8') });
    }
  }
}

function loadOrAnalyzeModel(dir: string, modelPath: string): Promise<ModuleModel> {
  if (fs.existsSync(modelPath)) {
    return Promise.resolve(JSON.parse(fs.readFileSync(modelPath, 'utf-8')) as ModuleModel);
  }
  const files: InputFile[] = [];
  collectCFiles(dir, dir, files);
  return analyzeModule(files);
}

function makeProvider(mock: boolean): LLMProvider {
  if (mock) return new MockProvider();
  const config = resolveConfig(loadConfigFile().llm);
  if (!config.baseUrl) {
    console.error('未配置 LLM 地址。设置环境变量 LLD_LLM_BASE_URL（如 http://server:8000/v1），'
      + '或在当前目录建 lld.config.json（{"llm":{"baseUrl":"..."}}），或使用 --mock 离线预览');
    process.exit(1);
  }
  return new OpenAICompatibleProvider(config);
}

/** 连通性自检：GET /models + 一次最小 chat 调用，验证目标环境能否跑通 */
async function cmdPing(): Promise<void> {
  const config = resolveConfig(loadConfigFile().llm);
  if (!config.baseUrl) {
    console.error('未配置 LLM 地址（LLD_LLM_BASE_URL 或 lld.config.json）');
    process.exit(1);
  }
  const base = normalizeBaseUrl(config.baseUrl);
  console.log(`目标地址: ${base}`);
  console.log(`模型: ${config.model}`);

  // 1) GET /models
  try {
    const t0 = Date.now();
    const resp = await fetch(`${base}/models`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - t0;
    if (!resp.ok) {
      console.error(`✗ /models 返回 ${resp.status}（${latency}ms）: ${(await resp.text()).slice(0, 200)}`);
      process.exit(1);
    }
    const data = await resp.json() as { data?: { id?: string }[] };
    const ids = (data.data ?? []).map(m => m.id).filter(Boolean);
    console.log(`✓ /models 可达（${latency}ms），可用模型: ${ids.length > 0 ? ids.join(', ') : '(列表为空)'}`);
    if (ids.length > 0 && !ids.includes(config.model)) {
      console.error(`警告: 配置的模型 "${config.model}" 不在服务模型列表中，请检查 LLD_LLM_MODEL`);
    }
  } catch (err) {
    console.error(`✗ /models 连接失败: ${(err as Error).message}`);
    console.error('  排查方向：网络是否可达（同网段/VPN）、端口是否对、服务是否启动');
    process.exit(1);
  }

  // 2) 最小 chat 调用（端到端验证生成链路）
  try {
    const t0 = Date.now();
    const provider = new OpenAICompatibleProvider(config);
    const reply = await provider.generate('你是助手。', '回复"ok"两个字母即可。', { maxTokens: 16 });
    console.log(`✓ chat 调用成功（${Date.now() - t0}ms），模型回复: ${reply.slice(0, 50)}`);
    console.log('\n连接正常，可以运行 gen。');
  } catch (err) {
    console.error(`✗ chat 调用失败: ${(err as Error).message}`);
    process.exit(1);
  }
}

async function cmdAnalyze(dir: string, outDir: string): Promise<ModuleModel> {
  const files: InputFile[] = [];
  collectCFiles(dir, dir, files);
  console.error(`扫描到 ${files.length} 个源文件`);
  const model = await analyzeModule(files);
  const output = path.join(outDir, 'lld_model.json');
  fs.writeFileSync(output, JSON.stringify(model, null, 2), 'utf-8');

  console.log(`\n模块: ${model.module}`);
  console.log(`外部接口函数 (5.2.3.2): ${model.providedFunctions.length}`);
  console.log(`内部函数 (5.2.4.2): ${model.internalFunctions.length}`);
  console.log(`内部变量 (5.2.4.1): ${model.internalVariables.length}`);
  console.log(`类型定义 (5.2.1.2): ${model.types.length}`);
  console.log(`外部调用 (5.2.2.2): ${model.calledExternalFunctions.length}`);
  console.log(`配置宏 (6): ${model.configMacros.length}`);
  console.log(`\n中间模型已写入: ${output}`);
  return model;
}

/** 模块版本更新比对：analyze 新代码 → 与既有 design json 按哈希锚点比对 →
 *  产出四类清单（未变/变更/新增/删除）+ 合并 design json（新模型打底，
 *  未变条目回挂已生成内容，变更/新增条目待 gen --resume 重生）。
 *  落盘：lld_model.json（新）、lld_design.json（合并）、lld_diff.json（清单，报告附录 A 用）。 */
async function cmdDiff(dir: string, outDir: string): Promise<ModuleDiff> {
  const designPath = path.join(outDir, 'lld_design.json');
  if (!fs.existsSync(designPath)) {
    console.error(`未找到既有产物 ${designPath}——首次生成请用 run/gen，diff/update 用于版本更新场景`);
    process.exit(1);
  }
  const oldDesign = JSON.parse(fs.readFileSync(designPath, 'utf-8')) as ModuleModel;
  const newModel = await cmdAnalyze(dir, outDir);

  const diff = diffModules(oldDesign, newModel);
  const merged = applyModuleDiff(newModel, oldDesign, diff);
  fs.writeFileSync(designPath, JSON.stringify(merged, null, 2), 'utf-8');
  const diffPath = path.join(outDir, 'lld_diff.json');
  fs.writeFileSync(diffPath, JSON.stringify(diff, null, 2), 'utf-8');
  // Polarion 同步操作单（新建/更新/删除/疑似改名配对，按章节排序）
  const sync = buildPolarionSync(diff, oldDesign, newModel);
  const syncPath = path.join(outDir, 'lld_polarion_sync.json');
  fs.writeFileSync(syncPath, JSON.stringify(sync, null, 2), 'utf-8');

  console.log('\n===== 版本差异清单 =====');
  const f = diff.functions;
  console.log(`函数: 未变 ${f.unchanged.length} / 变更 ${f.changed.length} / 新增 ${f.added.length} / 删除 ${f.removed.length}`);
  for (const c of f.changed) console.log(`  变更[${c.kind === 'sig' ? '签名' : '实现'}]: ${c.name}`);
  for (const n of f.added) console.log(`  新增: ${n}`);
  for (const n of f.removed) console.log(`  删除: ${n}`);
  const misc = (label: string, c: { changed: string[]; added: string[]; removed: string[] }): void => {
    const n = c.changed.length + c.added.length + c.removed.length;
    if (n > 0) console.log(`${label}: 变更 ${c.changed.length} / 新增 ${c.added.length} / 删除 ${c.removed.length}（${[...c.changed, ...c.added, ...c.removed].join(', ')}）`);
  };
  misc('类型', diff.types);
  misc('外部接口', diff.externals);
  misc('配置宏', diff.configs);
  if (!diff.hasChanges) {
    console.log('无差异（代码未变）——gen --resume 将只重物化 document 节');
  } else {
    console.log(`失效待重生: ${f.changed.length + f.added.length} 个函数条目`
      + `${diff.dynamicInvalidated ? '、动态设计（状态机+序列图）' : ''}`
      + `${diff.descriptionInvalidated ? '、5.1 功能描述' : ''}、document 节`);
  }
  console.log(`\n差异清单已写入: ${diffPath}`);
  const syncActionLabel: Record<string, string> = { delete: '删除', update: '更新', create: '新建', rename: '改名' };
  if (sync.operations.length > 0) {
    console.log('\n===== Polarion 同步操作单 =====');
    for (const op of sync.operations) {
      console.log(`  [${syncActionLabel[op.action]}] ${op.chapter} ${op.title}${op.from ? `（原 ${op.from}）` : ''}——${op.detail}`);
    }
    console.log(`未变条目零操作: 函数 ${sync.untouched.functions} / 类型 ${sync.untouched.types} / 外部接口 ${sync.untouched.externals} / 配置宏 ${sync.untouched.configs}`);
    console.log(`同步操作单已写入: ${syncPath}`);
  }
  if (sync.chapterUpdates.length > 0) {
    console.log('\n===== 章节级内容更新（工作项之外） =====');
    for (const cu of sync.chapterUpdates) {
      console.log(`  [更新] ${cu.chapter} ${cu.title}——${cu.reason}`);
    }
  }
  console.log('继续：gen --resume 增量重生失效条目（未变内容含人工修订全部保留）');
  return diff;
}

async function cmdGen(dir: string, outDir: string, mock: boolean, only?: string[], resume?: boolean): Promise<{ schemaProblems: string[]; failures: string[] }> {
  const modelPath = path.join(outDir, 'lld_model.json');
  const designPath = path.join(outDir, 'lld_design.json');
  // --resume：优先加载已有的 design json（含已生成内容），跳过已完成条目
  const model = resume && fs.existsSync(designPath)
    ? (JSON.parse(fs.readFileSync(designPath, 'utf-8')) as ModuleModel)
    : await loadOrAnalyzeModel(dir, modelPath);
  // 流程图/骨架内容均为静态生成（零 LLM）：--only 全为 flowcharts/document 时不构造 provider，无 LLM 环境也能刷
  const noLlmOnly = only !== undefined
    && (only.includes('flowcharts') || only.every(o => o === 'flowcharts' || o === 'document'));
  const provider = noLlmOnly ? null : makeProvider(mock);
  console.error(`LLM Provider: ${provider ? provider.name : '无（静态生成）'}`);

  // 增量落盘：每完成一个条目（onProgress 在进入下一条目前触发）就把 model 写回，
  // 中途断网/进程被杀时，已生成的内容不丢失，可用 --resume 续跑
  const save = (): void => {
    fs.writeFileSync(designPath, JSON.stringify(model, null, 2), 'utf-8');
  };
  const failures: string[] = [];
  // 外部缩写定义（abbreviationsDoc/JSON 节）注入文本类生成，术语口径与外部一致
  const abbr = resolveAbbreviations(loadConfigFile());
  if (abbr) console.log(`术语表: ${abbr.entries.length} 条（${abbr.replace ? `外部表 ${abbr.source}` : 'JSON 配置'}），按 prompt 内出现过滤注入`);
  // 流程图静态生成的源码读取通道（fn.file 为 analyze 时相对 dir 的路径）
  const readSource = (rel: string): string | null => {
    try { return fs.readFileSync(path.join(dir, rel), 'utf-8'); } catch { return null; }
  };
  await generateDesign(model, provider, {
    only,
    skipExisting: resume,
    failures,
    abbreviations: abbr?.entries,
    abbreviationTable: abbr
      ? { entries: abbr.entries, definitions: abbr.definitions, replace: abbr.replace, source: abbr.source }
      : undefined,
    readSource,
    onProgress: msg => {
      save();
      console.error(`  ${msg}`);
    },
  });
  save();

  // 结构完整性自检（0930 冻结 v1）：本阶段应产出的字段缺失即失败，防残缺 json 静默流出
  const schemaProblems = lintModelSchema(model, {
    requireDocument: !only || only.includes('document'),
    requireDynamic: !only || only.includes('dynamic'),
  });
  if (schemaProblems.length > 0) {
    console.log(`\n✗ 结构完整性自检 ${schemaProblems.length} 项缺失:`);
    for (const p of schemaProblems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }

  if (failures.length > 0) {
    console.log(`\n⚠ ${failures.length} 个条目生成失败（加 --resume 可只重试这些条目）:`);
    for (const f of failures) console.log(`  - ${f}`);
  }

  const enriched = [...model.providedFunctions, ...model.internalFunctions].filter(f => f.generated);
  console.log(`\n生成完成: ${enriched.length} 个函数描述`);
  if (model.dynamicDesign) {
    if (model.dynamicDesign.stateMachine) console.log(`  状态机: ${model.dynamicDesign.stateMachine.name}`);
    for (const seq of model.dynamicDesign.sequences) console.log(`  序列图: ${seq.name}`);
  }
  console.log(`已写入: ${designPath}`);
  return { schemaProblems, failures };
}

/** 一键全流程（工具集成入口）：analyze → gen（增量续跑）→ report → audit。
 *  退出码：0=全绿；1=任一步骤异常或 gen 结构自检未过（残缺 json 不产出报告）；
 *  2=流程走完但有个别条目生成失败（报告已产出，可 --resume 续跑补齐）。
 *  审计项（斜线/贴缘等设计内行为）不影响退出码，以 audit 打印的中文验收报告为准。 */
async function cmdRun(dir: string, outDir: string, mock: boolean, withImages: boolean, skipAudit: boolean): Promise<void> {
  console.log('===== [1/4] 静态分析 =====');
  await cmdAnalyze(dir, outDir);
  await finishPipeline(dir, outDir, mock, withImages, skipAudit);
}

/** 版本更新一键流程：diff（analyze+比对+失效合并）→ gen --resume（只重生失效条目）→ report → audit。
 *  退出码同 run。 */
async function cmdUpdate(dir: string, outDir: string, mock: boolean, withImages: boolean, skipAudit: boolean): Promise<void> {
  console.log('===== [1/4] 版本差异比对 =====');
  await cmdDiff(dir, outDir);
  await finishPipeline(dir, outDir, mock, withImages, skipAudit);
}

/** run/update 共用后半段：gen --resume → （可选 images）→ report → audit */
async function finishPipeline(dir: string, outDir: string, mock: boolean, withImages: boolean, skipAudit: boolean): Promise<void> {
  console.log('\n===== [2/4] LLM 生成设计内容 =====');
  const { schemaProblems, failures } = await cmdGen(dir, outDir, mock, undefined, true);
  if (schemaProblems.length > 0) {
    console.error('\n✗ 结构完整性自检未过，中止：残缺 json 不产出报告（修复后可原命令重跑，增量续跑）');
    process.exit(1);
  }
  if (withImages) {
    console.log('\n===== 图 PNG 物化 =====');
    await cmdImages(outDir, true);
  }
  console.log('\n===== [3/4] 生成 HTML 评审报告 =====');
  await cmdReport(outDir);
  if (!skipAudit) {
    console.log('\n===== [4/4] 渲染质量验收 =====');
    await cmdAudit(outDir);
  }
  if (failures.length > 0) {
    console.error(`\n⚠ ${failures.length} 个条目生成失败，报告已产出但内容不全；原命令重跑即可增量补齐`);
    process.exit(2);
  }
  console.log(`\n一键全流程完成 ✓ 产物目录: ${outDir}`);
}

async function cmdReport(outDir: string): Promise<void> {
  const designPath = path.join(outDir, 'lld_design.json');
  const modelPath = path.join(outDir, 'lld_model.json');
  const sourcePath = fs.existsSync(designPath) ? designPath : modelPath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`未找到 ${designPath}，请先运行 analyze（和 gen）`);
    process.exit(1);
  }
  const model = JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as ModuleModel;
  // 内嵌 mermaid.js，报告离线渲染图
  const mermaidPath = new URL('../assets/mermaid.min.js', import.meta.url);
  let mermaidJs: string | undefined;
  try {
    mermaidJs = fs.readFileSync(mermaidPath, 'utf-8');
  } catch {
    console.error('警告: 未找到 mermaid.min.js，图将以源码显示');
  }
  // 骨架内容（document 节）已物化 → 纯渲染只读 json；未物化（存量产物）→ 回退 report 期现读配置，
  // 同一实现产物一致，但缩写表随 config 漂移，建议 gen --only document --resume 物化定型
  let abbrOpts = {};
  if (!model.document) {
    const abbr = resolveAbbreviations(loadConfigFile());
    abbrOpts = {
      abbreviations: abbr?.entries,
      abbreviationsReplace: abbr?.replace,
      abbreviationSource: abbr?.source,
      definitions: abbr?.definitions,
    };
    console.error('提示: design json 无 document 节，1/2/3/7/8 章按 report 期配置现算（可 gen --only document --resume 物化进 json）');
  }
  const html = generateHtmlReport(model, {
    mermaidJs,
    ...abbrOpts,
    onAbbreviationGaps: abbrGapLogger,
    // 版本更新差异清单（update/diff 产物）→ 报告附录 A；无存量的产物不渲染该节
    diff: (() => {
      const p = path.join(outDir, 'lld_diff.json');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as ModuleDiff : undefined;
    })(),
    // Polarion 同步操作单（diff 产物）→ 附录 A 操作表；无存量不渲染
    sync: (() => {
      const p = path.join(outDir, 'lld_polarion_sync.json');
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as PolarionSync : undefined;
    })(),
  });
  const output = path.join(outDir, 'lld_report.html');
  fs.writeFileSync(output, html, 'utf-8');
  console.log(`评审报告已生成: ${output}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  // 位置参数：剔除 --out/--only 及其值，剩下的才是命令参数
  const flagsWithValue = new Set(['--out', '--only']);
  const positional: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const a = args[i]!;
    if (flagsWithValue.has(a)) { i++; continue; }
    if (!a.startsWith('--')) positional.push(a);
  }
  const mock = args.includes('--mock');
  const resume = args.includes('--resume');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.split(',') : undefined;

  const dir = positional[0] ? path.resolve(positional[0]) : '';
  // 产物目录：--out 指定；未指定时默认与模块目录相同（向后兼容）
  const outIdx = args.indexOf('--out');
  const outDir = dir
    ? path.resolve(outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : dir)
    : '';
  if (dir) fs.mkdirSync(outDir, { recursive: true });

  switch (command) {
    case 'ping':
      await cmdPing();
      return;
    case 'analyze':
      if (!dir) break;
      await cmdAnalyze(dir, outDir);
      return;
    case 'gen':
      if (!dir) break;
      if (only?.includes('images')) {
        if (only.length > 1) {
          console.error('--only images 不与其他类别混用（图 PNG 物化需 Edge，免 LLM）');
          process.exit(1);
        }
        await cmdImages(outDir, resume === true);
        return;
      }
      await cmdGen(dir, outDir, mock, only, resume);
      return;
    case 'report':
      if (!dir) break;
      await cmdReport(outDir);
      return;
    case 'audit':
      if (!dir) break;
      await cmdAudit(outDir);
      return;
    case 'run':
      if (!dir) break;
      await cmdRun(dir, outDir, mock, args.includes('--images'), args.includes('--skip-audit'));
      return;
    case 'diff':
      if (!dir) break;
      await cmdDiff(dir, outDir);
      return;
    case 'update':
      if (!dir) break;
      await cmdUpdate(dir, outDir, mock, args.includes('--images'), args.includes('--skip-audit'));
      return;
  }

  console.error(`用法:
  lld run <模块目录> [--out 产物目录] [--mock] [--images] [--skip-audit]
                                        一键全流程（工具集成入口）：analyze → gen（增量续跑）→ report → audit；
                                        退出码 0=全绿 / 1=异常或结构自检未过（不出报告）/ 2=个别条目失败（报告已出，重跑补齐）；
                                        --images 追加图 PNG 物化（归档用，需 Edge）；--skip-audit 跳过渲染验收
  lld update <模块目录> [--out 产物目录] [--mock] [--images] [--skip-audit]
                                        模块版本更新一键流程（需既有产物）：diff 比对 → gen --resume
                                        只重生变更/新增条目（未变内容含人工修订全部保留）→ report → audit；
                                        退出码同 run；差异清单落盘 lld_diff.json 并进报告附录 A
  lld diff <模块目录> [--out 产物目录]    只做版本比对：analyze 新代码 → 与既有 design json 按哈希锚点
                                        比对出四类清单（未变/变更/新增/删除）+ 合并 design json（失效待重生）
  lld ping                              LLM 连通性自检（/models + 最小 chat 调用）
  lld analyze <模块目录> [--out 产物目录]   静态分析，产出 lld_model.json
  lld gen <模块目录> [--out 产物目录] [--mock] [--resume] [--only 函数名,dynamic,configs,callouts,flowcharts,types,externals,description,document,images]
                                        LLM 生成设计内容，产出 lld_design.json（增量落盘，中断可 --resume 续跑）
                                        --only flowcharts 仅重刷各函数流程图（可叠加函数名缩小范围），保留描述；
                                        流程图为静态生成（tree-sitter CFG），该模式免 LLM 配置
                                        --only types / externals / description 分别补类型描述 / 非Callout外部接口说明 / 5.1模块功能描述
                                        --only document 物化报告骨架内容（1/2/3/7/8 章与引导句，含 3.1/3.2 缩写定义表
                                        按 gen 期 lld.config.json 缩写表定型）进 document 节，免 LLM；配 --resume 加载 design json
                                        --only images 图 PNG 物化：全部六类 mermaid 图渲染成 PNG（2x）以 base64 存回
                                        design json（不与其他类别混用，需 Edge，免 LLM；--resume 跳过已有 PNG 的图）
  lld report <模块目录> [--out 产物目录]    生成 HTML 评审报告 lld_report.html
  lld audit <模块目录> [--out 产物目录]     渲染质量验收：Edge 预渲染（lld_report.html 成品版）+
                                        斜线计数/交叉穿盒/箭头朝向审计，打印中文量化报告（需 Edge）
  （不带 --out 时产物写在模块目录内；report/audit 只需 --out 指向产物目录，模块目录仅作占位）
LLM 配置: 环境变量 LLD_LLM_BASE_URL / LLD_LLM_API_KEY / LLD_LLM_MODEL / LLD_LLM_TIMEOUT_MS，
  或当前目录 lld.config.json（{"llm":{"baseUrl":"http://server:4000","model":"..."}}）；只给 host:port 时自动补 /v1`);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
