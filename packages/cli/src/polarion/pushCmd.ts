/**
 * polarion push 骨架（D6）：真实走 配置解析 → collect → createPolarionClient，
 * 打印将用的连接参数与工作项数后调 client.push()——本期抛「未实现」。
 * 配置缺失时给明确指引（export / map-ids 不依赖连接三件套，仅 push 需要）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectWorkItems, createPolarionClient, type ModuleModel, type PolarionConfig,
} from '@lld/core';

export async function cmdPolarionPush(outDir: string, cfg: PolarionConfig): Promise<void> {
  if (!cfg.baseUrl || !cfg.projectId) {
    console.error('未配置 Polarion 连接。设置环境变量 LLD_POLARION_BASE_URL / LLD_POLARION_PROJECT_ID'
      + '（可选 LLD_POLARION_TOKEN），或在当前目录 lld.config.json 加 "polarion" 节（参照 lld.config.example.json）');
    process.exit(1);
  }
  const designPath = path.join(outDir, 'lld_design.json');
  const modelPath = path.join(outDir, 'lld_model.json');
  const sourcePath = fs.existsSync(designPath) ? designPath : modelPath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`未找到 ${designPath}，请先运行 analyze（和 gen）`);
    process.exit(1);
  }
  const model = JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as ModuleModel;
  const drafts = collectWorkItems(model, cfg);

  const client = createPolarionClient(cfg);
  console.log(`目标: ${client.baseUrl} 项目: ${client.projectId}`);
  console.log(`待推送工作项: ${drafts.length} 个`);
  await client.push(drafts); // 本期必抛「未实现」
}
