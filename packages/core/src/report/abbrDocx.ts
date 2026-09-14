/**
 * 外部缩写表 .docx 解析（零依赖）：docx = zip(word/document.xml)，本模块只取其中的表格。
 * core 不碰文件系统——由 CLI 读入 Buffer 后传入。
 *
 * 表格约定：两列及以上，表头含「缩写/abbreviation」的列为缩写列、含「定义/描述/definition/meaning」的列为定义列；
 * 无表头行时按第 1 列=缩写、第 2 列=定义。多个表格会合并（同名后者不覆盖前者）。
 * 局限：手撸 XML 提取不支持单元格内嵌套表格（缩写表不会有）；Word/WPS 产出的标准 docx 均可解析。
 */
import { inflateRawSync } from 'node:zlib';

function readDocxEntry(buf: Buffer, entryName: string): Buffer {
  // End Of Central Directory：从文件尾 64KB 内找签名 0x06054b50
  const tail = buf.subarray(Math.max(0, buf.length - 65536));
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip/docx 文件（找不到中央目录）');
  const cdCount = tail.readUInt16LE(eocd + 10);
  const cdSize = tail.readUInt32LE(eocd + 12);
  const cdOff = tail.readUInt32LE(eocd + 16);
  if (cdOff + cdSize > buf.length) throw new Error('zip 中央目录越界（文件损坏？）');
  let cur = cdOff;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(cur) !== 0x02014b50) throw new Error('zip 中央目录条目损坏');
    const method = buf.readUInt16LE(cur + 10);
    const compSize = buf.readUInt32LE(cur + 20);
    const nameLen = buf.readUInt16LE(cur + 28);
    const extraLen = buf.readUInt16LE(cur + 30);
    const commentLen = buf.readUInt16LE(cur + 32);
    const localOff = buf.readUInt32LE(cur + 42);
    const name = buf.toString('utf-8', cur + 46, cur + 46 + nameLen);
    if (name === entryName) {
      // 本地文件头：名字/扩展字段长度可能与中央目录不同，须现场读
      if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('zip 本地文件头损坏');
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const dataOff = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataOff, dataOff + compSize);
      if (method === 0) return raw;
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`不支持的 zip 压缩方式 ${method}（Word 文档应为 deflate）`);
    }
    cur += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`docx 内找不到 ${entryName}（不是 Word 文档？）`);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 单元格文本：拼接所有 <w:t> 段（Word 会把一段文字拆多个 run） */
function cellText(tc: string): string {
  let out = '';
  for (const m of tc.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) out += m[1];
  return decodeXmlEntities(out).replace(/\u00A0/g, ' ').trim();
}

/** docx 解析结果：缩写表条目 + 定义表条目（对应外部文档的「缩写」「定义」两节） */
export interface AbbreviationsDoc {
  abbreviations: [string, string][];
  definitions: [string, string][];
}

/** 解析 docx 全部表格 → 缩写/定义两类条目（同名后者不覆盖前者；名或定义为空、整行空白跳过）。
 *  表格分类按表头：含「缩写/abbrev」列 → 缩写表；含整格「名称/定义/术语/name/term」→ 定义表；
 *  只有「定义/描述/含义」列而无缩写列 → 仍按缩写表取首两列（兼容无标准表头的补充表）；
 *  完全无表头 → 第 1 列=缩写、第 2 列=定义。 */
export function parseAbbreviationsDocx(buf: Buffer): AbbreviationsDoc {
  const xml = readDocxEntry(buf, 'word/document.xml').toString('utf-8');
  const abbreviations: [string, string][] = [];
  const definitions: [string, string][] = [];
  const seenAbbr = new Set<string>();
  const seenDef = new Set<string>();
  for (const tbl of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
    const rows: string[][] = [];
    for (const tr of tbl[0].matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)) {
      const cells: string[] = [];
      for (const tc of tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)) cells.push(cellText(tc[0]));
      if (cells.some(c => c !== '')) rows.push(cells);
    }
    if (rows.length === 0) continue;
    const head = rows[0]!;
    const hi = head.findIndex(c => /缩写|abbrev/i.test(c));
    const di = head.findIndex(c => /定义|描述|含义|说明|definition|meaning|description/i.test(c));
    // 整格匹配防误伤：「定义」列出现在缩写表表头时是定义列，单独出现（名称|描述 / 定义|描述）才是定义表
    const ni = head.findIndex(c => /^(名称|定义|术语|name|term)$/i.test(c.trim()));
    let target: [string, string][], seen: Set<string>, keyCol: number, valCol: number, startRow: number;
    if (hi >= 0) {
      // 缩写表：缩写列定位，定义列取「定义/描述/含义」列或剩余首列
      target = abbreviations; seen = seenAbbr; keyCol = hi;
      valCol = di >= 0 && di !== hi ? di : (hi === 0 ? 1 : 0);
      startRow = 1;
    } else if (ni >= 0) {
      // 定义表：名称/定义列 + 描述列（修复旧版把「定义|描述」表列序取反的缺陷）
      target = definitions; seen = seenDef; keyCol = ni;
      valCol = di >= 0 && di !== ni ? di : (ni === 0 ? 1 : 0);
      startRow = 1;
    } else if (di >= 0) {
      // 无缩写列但有定义类列（如「补充表|含义」）→ 兼容形态，按缩写表取值
      target = abbreviations; seen = seenAbbr; keyCol = di === 0 ? 1 : 0; valCol = di;
      startRow = 1;
    } else {
      // 无表头：第 1 列=缩写、第 2 列=定义
      target = abbreviations; seen = seenAbbr; keyCol = 0; valCol = 1;
      startRow = 0;
    }
    for (let r = startRow; r < rows.length; r++) {
      const key = (rows[r]![keyCol] ?? '').trim();
      const val = (rows[r]![valCol] ?? '').trim();
      if (!key || !val) continue;
      const dedup = key.toUpperCase();
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      target.push([key, val]);
    }
  }
  if (abbreviations.length === 0 && definitions.length === 0) {
    throw new Error('docx 中未解析到任何缩写/定义条目（需为两列表格：缩写 | 描述）');
  }
  return { abbreviations, definitions };
}
