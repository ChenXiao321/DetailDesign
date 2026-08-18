#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeModule, generateDesign, generateHtmlReport, resolveConfig,
  OpenAICompatibleProvider, MockProvider,
  type InputFile, type ModuleModel, type LLMProvider,
} from '@lld/core';

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
  const config = resolveConfig();
  if (!config.baseUrl) {
    console.error('未配置 LLM 地址。设置环境变量 LLD_LLM_BASE_URL（如 http://server:8000/v1），或使用 --mock 离线预览');
    process.exit(1);
  }
  return new OpenAICompatibleProvider(config);
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

async function cmdGen(dir: string, outDir: string, mock: boolean, only?: string[]): Promise<void> {
  const modelPath = path.join(outDir, 'lld_model.json');
  const model = await loadOrAnalyzeModel(dir, modelPath);
  const provider = makeProvider(mock);
  console.error(`LLM Provider: ${provider.name}`);

  await generateDesign(model, provider, {
    only,
    onProgress: msg => console.error(`  ${msg}`),
  });

  const output = path.join(outDir, 'lld_design.json');
  fs.writeFileSync(output, JSON.stringify(model, null, 2), 'utf-8');

  const enriched = [...model.providedFunctions, ...model.internalFunctions].filter(f => f.generated);
  console.log(`\n生成完成: ${enriched.length} 个函数描述`);
  if (model.dynamicDesign) {
    if (model.dynamicDesign.stateMachine) console.log(`  状态机: ${model.dynamicDesign.stateMachine.name}`);
    for (const seq of model.dynamicDesign.sequences) console.log(`  序列图: ${seq.name}`);
  }
  console.log(`已写入: ${output}`);
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
  const positional = args.slice(1).filter(a => !a.startsWith('--'));
  const mock = args.includes('--mock');
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
    case 'analyze':
      if (!dir) break;
      await cmdAnalyze(dir, outDir);
      return;
    case 'gen':
      if (!dir) break;
      await cmdGen(dir, outDir, mock, only);
      return;
    case 'report':
      if (!dir) break;
      await cmdReport(outDir);
      return;
  }

  console.error(`用法:
  lld analyze <模块目录> [--out 产物目录]   静态分析，产出 lld_model.json
  lld gen <模块目录> [--out 产物目录] [--mock] [--only 函数名,dynamic,configs]   LLM 生成设计内容，产出 lld_design.json
  lld report <模块目录> [--out 产物目录]    生成 HTML 评审报告 lld_report.html
  （不带 --out 时产物写在模块目录内；report 只需 --out 指向产物目录，模块目录仅作占位）
环境变量: LLD_LLM_BASE_URL / LLD_LLM_API_KEY / LLD_LLM_MODEL`);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
