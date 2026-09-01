/**
 * Polarion 导出 csv 解析 + 工作项 ID 匹配回写。
 * 双保险匹配（D5）：① 描述内锚点 LLD-KEY: <key> 精确匹配 > ② title 精确匹配
 * （重复 title 按出现顺序配对并给 ⚠ 提示）→ 未匹配列清单，由 CLI 决定报错或 --partial 放行。
 */
import { markerOf, type WorkItemDraft } from './types.js';

export interface PolarionCsvRow {
  /** Polarion 工作项 ID（如 PROJ-123） */
  id: string;
  title: string;
  description: string;
}

export interface MatchResult {
  /** key → workItemId */
  matches: Map<string, string>;
  /** ⚠ 提示（重复 title 顺序配对等） */
  warnings: string[];
  /** 未匹配上的工作项 key（Polarion 侧找不到对应行） */
  unmatchedKeys: string[];
  /** Polarion 行中未匹配到任何工作项的 ID（多导出了别的项） */
  unmatchedIds: string[];
}

/** RFC4180 csv 解析：BOM、分隔符嗅探（表头原始行中 ; / \t 多于 , 则按之，Polarion 欧洲 locale 常见）、引号转义 */
export function parsePolarionCsv(text: string): PolarionCsvRow[] {
  let t = text;
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  if (t.length === 0) return [];

  // 表头原始行（引号内换行不可能出现在表头，直接取第一行）
  const headerLine = t.split(/\r\n|\r|\n/, 1)[0]!;
  const counts: Array<[string, number]> = [
    [',', (headerLine.match(/,/g) ?? []).length],
    [';', (headerLine.match(/;/g) ?? []).length],
    ['\t', (headerLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  const delim = counts[0]![1] > 0 ? counts[0]![0] : ',';

  // 单遍解析
  const records: string[][] = [];
  let field = '', record: string[] = [], inQuotes = false;
  const pushField = (): void => { record.push(field); field = ''; };
  const pushRecord = (): void => {
    pushField();
    if (record.length > 1 || record[0] !== '') records.push(record); // 跳过全空行（文件尾换行）
    record = [];
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      pushField();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      pushRecord();
    } else field += c;
  }
  pushRecord();
  if (records.length === 0) return [];

  const header = records[0]!.map(h => h.trim().toLowerCase());
  const colOf = (patterns: RegExp[]): number =>
    header.findIndex(h => patterns.some(p => p.test(h)));
  const idCol = colOf([/^id$/, /work.?item.?id/, /^编号$/]);
  const titleCol = colOf([/^title$/, /^标题$/]);
  const descCol = colOf([/^description$/, /^描述$/]);
  if (idCol < 0) {
    throw new Error(`导出 csv 缺少 ID 列（表头: ${header.join(' | ')}）`);
  }
  const rows: PolarionCsvRow[] = [];
  for (const cols of records.slice(1)) {
    const id = (cols[idCol] ?? '').trim();
    if (!id) continue;
    rows.push({
      id,
      title: titleCol >= 0 ? (cols[titleCol] ?? '').trim() : '',
      description: descCol >= 0 ? (cols[descCol] ?? '') : '',
    });
  }
  return rows;
}

const ANCHOR_RE = /LLD-KEY:\s*(\S+)/;

/** 匹配：锚点 > title（重复按顺序配对）。partial=false 时由 CLI 对 unmatchedKeys 报错退出 */
export function matchWorkItemIds(drafts: WorkItemDraft[], rows: PolarionCsvRow[]): MatchResult {
  const byKey = new Map(drafts.map(d => [d.key, d]));
  const matches = new Map<string, string>();
  const warnings: string[] = [];
  const usedRows = new Set<number>();

  // ① 锚点匹配
  rows.forEach((row, i) => {
    const m = ANCHOR_RE.exec(row.description);
    if (!m) return;
    const key = m[1]!;
    if (byKey.has(key) && !matches.has(key)) {
      matches.set(key, row.id);
      usedRows.add(i);
    }
  });

  // ② title 匹配（剩余行 × 剩余草稿；重复 title 按双方出现顺序配对）
  const draftByTitle = new Map<string, WorkItemDraft[]>();
  for (const d of drafts) {
    if (matches.has(d.key)) continue;
    const list = draftByTitle.get(d.title) ?? [];
    list.push(d);
    draftByTitle.set(d.title, list);
  }
  const rowByTitle = new Map<string, number[]>();
  rows.forEach((row, i) => {
    if (usedRows.has(i) || !row.title) return;
    const list = rowByTitle.get(row.title) ?? [];
    list.push(i);
    rowByTitle.set(row.title, list);
  });
  for (const [title, ds] of draftByTitle) {
    const idxs = rowByTitle.get(title) ?? [];
    ds.forEach((d, j) => {
      const i = idxs[j];
      if (i === undefined) return;
      matches.set(d.key, rows[i]!.id);
      usedRows.add(i);
      if (ds.length > 1 || idxs.length > 1) {
        warnings.push(`⚠ 重复 title「${title}」按出现顺序配对：${d.key} → ${rows[i]!.id}，请人工核对`);
      }
    });
  }

  const unmatchedKeys = drafts.filter(d => !matches.has(d.key)).map(d => d.key);
  const unmatchedIds = rows.filter((_, i) => !usedRows.has(i)).map(r => r.id);
  return { matches, warnings, unmatchedKeys, unmatchedIds };
}

/** 原地回写 workItemId 到实体 polarion marker（实体是 model 内引用，随后整体落盘即可） */
export function applyWorkItemIds(drafts: WorkItemDraft[], matches: Map<string, string>): number {
  let n = 0;
  for (const d of drafts) {
    const id = matches.get(d.key);
    if (!id) continue;
    markerOf(d).workItemId = id;
    d.workItemId = id;
    n++;
  }
  return n;
}
