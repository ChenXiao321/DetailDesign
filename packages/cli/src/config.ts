/** lld.config.json 加载（可选，放当前工作目录；已 gitignore，勿提交真实 token） */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseAbbreviationsDocx, type LLMConfig, type PolarionConfig } from '@lld/core';

export interface LldConfigFile {
  llm?: Partial<LLMConfig>;
  polarion?: Partial<PolarionConfig>;
  /** 3.1 缩写表追加词条：{ "SPI": "Serial Peripheral Interface 串行外设接口" }（同名覆盖内置词典；
   *  外部缩写表模式下仍生效：同名覆盖 docx 条目、新增条目补入——临时补表走这里，正式补充走 docx 维护方） */
  abbreviations?: Record<string, string>;
  /** 外部缩写表 .docx 路径（相对 cwd）：提供后 3.1/3.2 以该表为唯一来源（内置词典不兜底）、全量收录
   *  （不再按模块出现过滤）；docx 中「缩写」表进 3.1、「定义」表（表头 名称/定义|描述）进 3.2；
   *  正文出现但表内未定义的缩写会在 report/audit 输出缺口名单 */
  abbreviationsDoc?: string;
}

export function loadConfigFile(): LldConfigFile {
  const p = path.resolve('lld.config.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as LldConfigFile;
  } catch (err) {
    console.error(`警告: lld.config.json 解析失败，忽略该文件（${(err as Error).message}）`);
    return {};
  }
}

export interface AbbrResolved {
  entries: [string, string][];
  /** 外部 docx「定义」表条目（3.2 节全量收录；仅外部表模式有，JSON 节无此通道） */
  definitions: [string, string][];
  /** true = 外部缩写表模式：3.1/3.2 整章以 entries/definitions 为唯一来源（内置词典不兜底） */
  replace: boolean;
  /** 外部表来源文件名（报告 3.1 注释行展示） */
  source?: string;
}

/** 缩写两种提供方式解析：①外部 docx（abbreviationsDoc，整章替换模式）；②JSON 节（abbreviations，合并模式）。
 *  两者同时在场：docx 为主、JSON 同名覆盖+新增补入。docx 读取失败回退合并模式并告警。 */
export function resolveAbbreviations(cfg: LldConfigFile): AbbrResolved | undefined {
  const jsonEntries = Object.entries(cfg.abbreviations ?? {}).map(([k, v]) => [k, v] as [string, string]);
  if (cfg.abbreviationsDoc) {
    const p = path.resolve(cfg.abbreviationsDoc);
    try {
      const doc = parseAbbreviationsDocx(fs.readFileSync(p));
      const docKeys = new Set(doc.abbreviations.map(([a]) => a.toUpperCase()));
      const jsonMap = new Map(jsonEntries.map(([k, v]) => [k.toUpperCase(), v] as const));
      const entries: [string, string][] = [
        ...doc.abbreviations.map(([k, v]) => [k, jsonMap.get(k.toUpperCase()) ?? v] as [string, string]),
        ...jsonEntries.filter(([k]) => !docKeys.has(k.toUpperCase())),
      ];
      return { entries, definitions: doc.definitions, replace: true, source: path.basename(p) };
    } catch (err) {
      console.error(`警告: 外部缩写表 ${p} 读取失败（${(err as Error).message}），3.1 回退内置词典合并模式`);
    }
  }
  return jsonEntries.length > 0 ? { entries: jsonEntries, definitions: [], replace: false } : undefined;
}

/** report/audit 共用的缩写缺口提示回调（外部表模式下正文出现但无定义的缩写名单） */
export function abbrGapLogger(missing: string[]): void {
  console.warn(`⚠ 3.1 缩写表缺口：正文出现但外部缩写表未定义 → ${missing.join('、')}`);
  console.warn('  请反馈缩写表维护方补充 docx，或临时在 lld.config.json 的 abbreviations 节添加');
}
