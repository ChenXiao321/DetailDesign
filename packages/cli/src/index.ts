#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeModule, generateDesign, generateHtmlReport, resolveConfig, normalizeBaseUrl,
  OpenAICompatibleProvider, MockProvider, resolvePolarionConfig,
  type InputFile, type ModuleModel, type LLMProvider, type LLMConfig, type PolarionConfig,
} from '@lld/core';
import { cmdPolarionExport } from './polarion/exportCmd.js';
import { cmdPolarionMapIds } from './polarion/mapIdsCmd.js';
import { cmdPolarionPush } from './polarion/pushCmd.js';

/** lld.config.json（可选，放当前工作目录）：{ "llm": {...}, "polarion": {...} }（已 gitignore，勿提交真实 token） */
interface LldConfigFile { llm?: Partial<LLMConfig>; polarion?: Partial<PolarionConfig> }
function loadConfigFile(): LldConfigFile {
  const p = path.resolve('lld.config.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as LldConfigFile;
  } catch (err) {
    console.error(`警告: lld.config.json 解析失败，忽略该文件（${(err as Error).message}）`);
    return {};
  }
}

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

async function cmdAnalyze(dir: string, outDir: string): Promise<void> {
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
}

async function cmdGen(dir: string, outDir: string, mock: boolean, only?: string[], resume?: boolean): Promise<void> {
  const modelPath = path.join(outDir, 'lld_model.json');
  const designPath = path.join(outDir, 'lld_design.json');
  // --resume：优先加载已有的 design json（含已生成内容），跳过已完成条目
  const model = resume && fs.existsSync(designPath)
    ? (JSON.parse(fs.readFileSync(designPath, 'utf-8')) as ModuleModel)
    : await loadOrAnalyzeModel(dir, modelPath);
  const provider = makeProvider(mock);
  console.error(`LLM Provider: ${provider.name}`);

  // 增量落盘：每完成一个条目（onProgress 在进入下一条目前触发）就把 model 写回，
  // 中途断网/进程被杀时，已生成的内容不丢失，可用 --resume 续跑
  const save = (): void => {
    fs.writeFileSync(designPath, JSON.stringify(model, null, 2), 'utf-8');
  };
  const failures: string[] = [];
  await generateDesign(model, provider, {
    only,
    skipExisting: resume,
    failures,
    onProgress: msg => {
      save();
      console.error(`  ${msg}`);
    },
  });
  save();

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
  const html = generateHtmlReport(model, { mermaidJs });
  const output = path.join(outDir, 'lld_report.html');
  fs.writeFileSync(output, html, 'utf-8');
  console.log(`评审报告已生成: ${output}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  // 位置参数：剔除 --out/--only/--ids 及其值，剩下的才是命令参数
  const flagsWithValue = new Set(['--out', '--only', '--ids']);
  const positional: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const a = args[i]!;
    if (flagsWithValue.has(a)) { i++; continue; }
    if (!a.startsWith('--')) positional.push(a);
  }
  const mock = args.includes('--mock');
  const resume = args.includes('--resume');
  const partial = args.includes('--partial');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.split(',') : undefined;
  const idsIdx = args.indexOf('--ids');
  const idsPath = idsIdx >= 0 && args[idsIdx + 1] ? path.resolve(args[idsIdx + 1]!) : undefined;

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
      await cmdGen(dir, outDir, mock, only, resume);
      return;
    case 'report':
      if (!dir) break;
      await cmdReport(outDir);
      return;
    case 'polarion': {
      if (!dir) break;
      const sub = positional[1];
      const polarionCfg = resolvePolarionConfig(loadConfigFile().polarion);
      if (sub === 'export') {
        await cmdPolarionExport(outDir, polarionCfg);
        return;
      }
      if (sub === 'map-ids') {
        cmdPolarionMapIds(outDir, polarionCfg, idsPath, partial);
        return;
      }
      if (sub === 'push') {
        await cmdPolarionPush(outDir, polarionCfg);
        return;
      }
      console.error(`未知 polarion 子动作: ${sub ?? '(空)'}（支持 export / map-ids / push）`);
      process.exit(1);
    }
  }

  console.error(`用法:
  lld ping                              LLM 连通性自检（/models + 最小 chat 调用）
  lld analyze <模块目录> [--out 产物目录]   静态分析，产出 lld_model.json
  lld gen <模块目录> [--out 产物目录] [--mock] [--resume] [--only 函数名,dynamic,configs,callouts,flowcharts,types,externals,description]
                                        LLM 生成设计内容，产出 lld_design.json（增量落盘，中断可 --resume 续跑）
                                        --only flowcharts 仅重刷各函数流程图（可叠加函数名缩小范围），保留描述
                                        --only types / externals / description 分别补类型描述 / 非Callout外部接口说明 / 5.1模块功能描述
  lld report <模块目录> [--out 产物目录]    生成 HTML 评审报告 lld_report.html
  lld polarion <模块目录> [--out 产物目录] export
                                        生成 Polarion Word 导入文件（<out>/polarion/polarion_workitems.docx + manifest csv + figs/）
  lld polarion <模块目录> [--out 产物目录] map-ids --ids <Polarion导出csv> [--partial]
                                        导入后回写 workItemId 到 lld_design.json（锚点 LLD-KEY 匹配 > title 匹配）
  lld polarion <模块目录> [--out 产物目录] push
                                        REST 直连推送（本期仅骨架：校验配置并打印，推送报未实现）
  （不带 --out 时产物写在模块目录内；report/polarion 只需 --out 指向产物目录，模块目录仅作占位）
LLM 配置: 环境变量 LLD_LLM_BASE_URL / LLD_LLM_API_KEY / LLD_LLM_MODEL / LLD_LLM_TIMEOUT_MS，
  或当前目录 lld.config.json（{"llm":{"baseUrl":"http://server:4000","model":"..."}}）；只给 host:port 时自动补 /v1`);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
