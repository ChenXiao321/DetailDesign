/**
 * Mermaid 源码预处理（报告与 Polarion 单图渲染页共用，保证两边图一致）。
 * 从 htmlReport.ts 抽取，逻辑零改动。
 */

/**
 * 流程图 label 预折行：节点文字靠浏览器对 foreignObject 内 HTML 自动折行（mermaid label max-width 200px），
 * 个别浏览器中该折行失效，超长单行会被裁剪/溢出节点框。这里按估算像素宽度把每个 <br> 分段
 * 预先折到 200px 以内（优先在空格处断开，无空格长 token 硬断），渲染结果不再依赖浏览器折行。
 */
export function wrapFlowchartLabels(src: string): string {
  if (!/^\s*flowchart/.test(src)) return src;
  const MAX_W = 185;  // px @13px 字号，对 200px 上限留余量
  const charW = (ch: string) => (ch.charCodeAt(0) < 0x7f ? 7 : 13.5);  // ASCII ≈7px，全角/CJK ≈13.5px
  const segWidth = (s: string) => [...s.replace(/<[^>]+>/g, '')].reduce((w, c) => w + charW(c), 0);
  const wrapSeg = (seg: string): string => {
    if (segWidth(seg) <= MAX_W) return seg;
    const atoms = seg.match(/<[^>]+>|[\s\S]/g) ?? [];   // HTML 标签作为整体原子，不计宽、不在内部断
    const lines: string[] = [];
    let line = '', w = 0, lastSpace = -1, lastParen = -1;  // lastParen：（的下标，次优断点（断在其前）
    for (const atom of atoms) {
      if (atom.length > 1 && atom.startsWith('<')) { line += atom; continue; }
      const cw = charW(atom);
      if (w + cw > MAX_W && line) {
        if (lastSpace > 0) {                 // 回退到本行最后一个空格处断开
          lines.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1);
        } else if (lastParen > 0) {          // 无空格时优先断在（前，避免拆散括号词
          lines.push(line.slice(0, lastParen));
          line = line.slice(lastParen);
        } else {                             // 无空格长 token：硬断
          lines.push(line);
          line = '';
        }
        w = segWidth(line);
        lastSpace = line.lastIndexOf(' ');
        lastParen = line.lastIndexOf('（');
        if (atom === ' ') continue;          // 断点处的空格丢弃
      }
      if (atom === ' ') lastSpace = line.length;
      if (atom === '（') lastParen = line.length;
      line += atom; w += cw;
    }
    if (line) lines.push(line);
    return lines.join('<br>');
  };
  return src.split('\n').map(l =>
    // subgraph 标题（条件编译注释）不折行：mermaid 按单行计算框顶高度，多行标题会压到框内节点
    /^\s*subgraph\s/.test(l) ? l : l.replace(/"([^"\n]*)"/g, (_m, label: string) =>
      `"${label.split(/<br\s*\/?>/i).map(wrapSeg).join('<br>')}"`),
  ).join('\n');
}

/**
 * Mermaid 图源静态检查（报告生成时调用，打印警告不阻断）。
 * 动机：LLM 生成的图源偶有定界符错误（Qwen 批次实测：平行四边形 `[/"..."/]` 写成
 * `[/".../"]` 或漏收尾引号 `[/".../]`），mermaid 词法报错 → 该图渲染失败且
 * mermaid.run 整批 reject。这里在生成期就把可疑行点出来，避免到浏览器端才发现。
 * 返回问题描述列表（含行号），空数组 = 未发现问题。
 */
export function lintMermaidSource(src: string): string[] {
  const problems: string[] = [];
  if (!/^\s*(flowchart|graph|sequenceDiagram|stateDiagram)/.test(src)) return problems;
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) return;
    // 引号配平：本项目图源均为单行节点定义/连线，引号必成对出现
    const quotes = (line.match(/"/g) ?? []).length;
    if (quotes % 2 !== 0)
      problems.push(`第${i + 1}行引号不配平: ${line.slice(0, 80)}`);
    // 平行四边形 [/"..."/] 的收尾必须是 "/] 而非 /"]（引号在斜杠前）
    if (line.includes('[/"') && !line.includes('"/]'))
      problems.push(`第${i + 1}行平行四边形收尾应为 "/]: ${line.slice(0, 80)}`);
  });
  return problems;
}

/**
 * 流程图结构校验（gen 期硬校验，问题回喂 LLM 重试；报告期可作警告）。
 * 动机：Qwen 批次实测反复出现的结构性缺陷，mermaid 语法合法但图是错的——
 *   ① 开始胶囊声明了却没有 --> 出边（dagre 把它沉到图底成孤儿）
 *   ② 节点声明了却零连线（孤儿节点，如 TransmitData 的 DEM_REPORT_2）
 *   ③ 非结束节点没有出边（分支画一半，流程中断）
 *   ④ 判断菱形的 是/否 两支指向同一节点（空 else 支被错挂到处理节点，
 *      如 Mainfunction 的 J_CHK 两支都进失败处理盒；空支应连汇合点或结束节点）
 *   ⑤ 连线目标是 subgraph（mermaid 不允许内联边指向子图）
 *   ⑥ X = Y 伪别名行（flowchart 无别名语法，画了不生效）
 *   ⑦ 连线缺目标（行尾只有 -->）
 * 返回问题描述列表（面向模型的中文，含节点 id），空数组 = 未发现问题。
 */
export function lintFlowchartStructure(src: string): string[] {
  // 只校验 LLM 生成的自上而下流程图（prompt 规则 1 强制 flowchart TD）；
  // 报告自建的依赖概览图是 flowchart BT 且有意保留无连线节点，不在校验范围
  if (!/^\s*(flowchart|graph)\s+TD\b/.test(src)) return [];
  const problems: string[] = [];

  const subgraphIds = new Set<string>();
  const declared = new Map<string, string>();  // id -> 标签（形状声明过）
  const outReal = new Map<string, { target: string; label: string }[]>();
  const inReal = new Set<string>();
  const touched = new Set<string>();           // 任意连线（含 ~~~）涉及

  const ID = /^\s*([A-Za-z_]\w*)/;
  const idOf = (seg: string): string | null => (seg.match(ID) ?? [])[1] ?? null;
  // 形状声明（标签必带引号，本项目规则）：id([" / id[[" / id[/" / id[" / id{{" / id{" / id(("
  // 标签内禁止双引号（prompt 规则 5），故 [" 不可能出现在标签文本里，不会误匹配
  // 分支顺序有意义：多字符开括号（([[ 等）必须排在单字符（[ {）前面
  const DECL = /\b([A-Za-z_]\w*)\s*(?:\(\[|\(\(|\[\[|\[\/|\[|\{\{|\{)\s*"([^"]*)"/g;

  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    const sg = line.match(/^subgraph\s+([A-Za-z_]\w*)/);
    if (sg) { subgraphIds.add(sg[1]); continue; }
    if (/^(flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/.test(line)) continue;
    if (/^(end\b|style\s|classDef\s|class\s|direction\s|linkStyle\s)/.test(line)) continue;

    // 任意行内的形状声明都登记（含行内声明 --> B["..."]）
    for (const m of line.matchAll(DECL)) declared.set(m[1], m[2]);

    // ⑥ 伪别名：X = Y（既不是声明也不是连线）
    if (/^[A-Za-z_]\w*\s*=\s*[A-Za-z_]\w*$/.test(line)) {
      problems.push(`存在「${line.slice(0, 60)}」别名写法：flowchart 不支持 X = Y，请删除该行，后续连线直接使用原节点 id`);
      continue;
    }

    // 连线行：归一化去标签后按操作符切分
    if (/(~~~|-->|---|-\.->|==>)/.test(line)) {
      const isInvisible = line.includes('~~~') && !/(-->|-\.->|==>)/.test(line);
      // 先取带标签的 -- 标签 --> 边
      const labeled = [...line.matchAll(/([A-Za-z_]\w*)\s*--\s*([^-~>\n]+?)\s*-->\s*(.*)$/g)]
        .map(m => ({ from: m[1], label: m[2].trim(), rest: m[3] }));
      const bare = line.replace(/--\s*[^-~>\n][^-~>\n]*?\s*(?=-->|---|-\.->|==>)/g, ' @@LBL@@ ');
      const segs = bare.split(/~~~|-->|---|-\.->|==>|@@LBL@@/).map(s => s.trim()).filter(Boolean);
      const ids = segs.map(idOf).filter((x): x is string => !!x);
      if (ids.length >= 2) {
        for (let i = 0; i + 1 < ids.length; i++) {
          const a = ids[i], b = ids[i + 1];
          touched.add(a); touched.add(b);
          if (!isInvisible) {
            const lbl = (labeled.find(l => l.from === a) ?? { label: '' }).label;
            (outReal.get(a) ?? outReal.set(a, []).get(a)!).push({ target: b, label: lbl });
            inReal.add(b);
          }
        }
      }
      // ⑦ 行尾只有箭头没有目标
      if (/(-->|-\.->|==>)\s*$/.test(line)) {
        problems.push(`存在缺目标的连线（行尾只有箭头）: ${line.slice(0, 70)}，请补上目标节点 id`);
      }
      continue;
    }
  }

  const isNote = (id: string, label: string) => /_NOTE$/i.test(id) || label.startsWith('注：') || label.startsWith('注:');
  const isTerminal = (label: string) => /结束|^end$|返回|return/i.test(label.replace(/<br\s*\/?>/gi, ''));
  const isPill = (id: string) => new RegExp(`\\b${id}\\s*\\(\\[`).test(src);  // 胶囊=端子，天然豁免出边检查
  const isStart = (label: string) => /^(开始|Start)$/i.test(label.replace(/<br\s*\/?>/gi, '').trim());
  // 空标签节点（id[" "]）是隐形汇合点/泳道入口约定（配 transparent style + ~~~ 钉位），豁免出边检查
  const isJunction = (label: string) => label.trim() === '';

  // ④ 菱形 是/否 同目标（在出边收集里按标签查）
  for (const [id, outs] of outReal) {
    if (!new RegExp(`\\b${id}\\s*\\{`).test(src)) continue;  // 仅判断菱形节点
    const yes = outs.filter(o => o.label === '是').map(o => o.target);
    const no = outs.filter(o => o.label === '否').map(o => o.target);
    const same = yes.filter(t => no.includes(t));
    if (same.length > 0) {
      problems.push(`判断节点 ${id} 的「是」和「否」分支指向了同一节点 ${same[0]}：空 else 分支应连到后续汇合点或结束节点，两个分支必须通向不同节点`);
    }
  }

  // ⑤ 连线目标是 subgraph
  for (const [id, outs] of outReal) {
    for (const o of outs) {
      if (subgraphIds.has(o.target)) {
        problems.push(`连线 ${id} --> ${o.target} 的目标是 subgraph：mermaid 不允许把子图当连线目标，请改为连接子图内的具体节点 id`);
      }
    }
  }

  // ⑧ 幽灵节点：连线引用了从未做形状声明的 id（mermaid 会渲染成以 id 为文字的裸盒）；
  //    实测成因是 Qwen 写了两套不一致的节点 id（如 LANE_FWD 链与 CALC_FWD 链并存）
  const phantom = new Map<string, string>();  // 幽灵 id -> 首个引用方
  for (const [id, outs] of outReal) {
    if (!declared.has(id) && !subgraphIds.has(id) && !phantom.has(id)) phantom.set(id, `（被 ${id} 的入边引用）`);
    for (const o of outs) {
      if (!declared.has(o.target) && !subgraphIds.has(o.target) && !phantom.has(o.target)) {
        phantom.set(o.target, `（被 ${id} --> ${o.target} 引用）`);
      }
    }
  }
  for (const [id, where] of phantom) {
    problems.push(`节点 ${id} 没有形状声明${where}：会渲染成以 id 为文字的裸盒。请为它补形状声明（如 ${id}["说明"]），或检查是否写错了节点 id（与已有节点 id 不一致）`);
  }

  // ① ② ③ 仅检查声明过的节点
  for (const [id, label] of declared) {
    if (subgraphIds.has(id)) continue;
    if (isStart(label)) {
      if (!(outReal.get(id)?.length)) {
        problems.push(`开始节点 ${id}(["开始"]) 没有任何出边：请把它接到流程第一个节点，如 ${id} --> <首节点id>`);
      }
      continue;
    }
    if (isNote(id, label)) {
      if (!touched.has(id)) problems.push(`注释节点 ${id} 没有任何连线：请用 ~~~ 不可见连线钉到该段第一个节点`);
      continue;
    }
    if (!touched.has(id) || (!inReal.has(id) && !(outReal.get(id)?.length))) {
      problems.push(`节点 ${id} 声明了但没有任何流程连线（孤儿节点）：请把它接入流程（补入边和出边），或删除该节点`);
      continue;
    }
    if (!isTerminal(label) && !isPill(id) && !isJunction(label) && !(outReal.get(id)?.length)) {
      problems.push(`节点 ${id} 没有出边，流程在此中断：除结束/返回节点外每个节点都必须有出边，空分支（do nothing）也要连到汇合点或结束节点`);
    }
  }
  return problems;
}

/**
 * 「结束」节点钉底：dagre 最长路径排名把结束放在其入边来源（多为循环条件菱形）的下一层，
 * 循环体更深时结束会悬在图中间（如 CheckInitRslt：D1 --否--> END 与循环体同层）。
 * 这里在 DAG（去回边）上从「开始」算最长路径深度，从所有不浅于结束的节点各引一条
 * ~~~ 隐形链到结束，强制其沉到最底；结束本就在底部的图深度已满、不加任何边，布局零影响。
 */
export function pinEndNodeToBottom(src: string): string {
  if (!/^\s*flowchart/.test(src)) return src;
  const lines = src.split('\n');
  // 体育场形端子节点：ID(["label"])
  const ends: string[] = [];
  let startId: string | null = null;
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*\(\s*\[\s*"([^"]*)"\s*\]\s*\)/g)) {
    const label = m[2].replace(/<br\s*\/?>/gi, '').trim();
    if (/^(结束|End)$/i.test(label)) ends.push(m[1]);
    if (/^(开始|Start)$/i.test(label)) startId = m[1];
  }
  if (ends.length === 0) return src;
  // 解析边（只取 --> / --- 有向/无箭头连线；~~~ 隐形钉链不参与深度）
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    nodes.add(a); nodes.add(b);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
  };
  for (const raw of lines) {
    if (/^\s*(subgraph|end\b|style|classDef|class\s|direction|linkStyle|%%)/.test(raw)) continue;
    // 带标签连线归一成裸操作符：D1 -- 是 --> R / W -- 否 --- J
    const line = raw.replace(/--\s*[^-~>\n][^-~>\n]*?\s*(?=-->|---)/g, '');
    if (!/(~~~|-->|---|-\.->|==>)/.test(line)) continue;
    const segs = line.split(/~~~|-->|---|-\.->|==>/);
    if (line.includes('~~~')) continue;  // ~~~ 隐形钉链不参与深度
    const ids = segs.map(s => (s.match(/\b([A-Za-z_]\w*)\b/) ?? [])[1]);
    for (let i = 0; i + 1 < ids.length; i++) {
      if (ids[i] && ids[i + 1]) addEdge(ids[i]!, ids[i + 1]!);
    }
  }
  // DAG 最长路径深度：DFS 丢弃指向栈上祖先的回边（循环回边），深度单调递增必然收敛
  const depth = new Map<string, number>();
  const onStack = new Set<string>();
  const visit = (u: string, d: number): void => {
    if (onStack.has(u) || (depth.get(u) ?? -1) >= d) return;
    depth.set(u, d);
    onStack.add(u);
    for (const v of adj.get(u) ?? []) visit(v, d + 1);
    onStack.delete(u);
  };
  if (startId) visit(startId, 0);
  for (const n of nodes) if (!depth.has(n)) visit(n, 0);  // 开始不可达的游离节点按根处理
  // 从所有不浅于结束的节点引隐形链；插在结束首次出现行之后（保持同一 subgraph 作用域）
  const pins: string[] = [];
  for (const e of ends) {
    const de = depth.get(e) ?? 0;
    for (const [n, d] of depth) if (n !== e && d >= de) pins.push(`    ${n} ~~~ ${e}`);
  }
  if (pins.length === 0) return src;
  const firstEnd = ends[0]!;
  const idx = lines.findIndex(l => new RegExp(`\\b${firstEnd}\\b`).test(l));
  lines.splice(idx >= 0 ? idx + 1 : lines.length, 0, ...pins);
  return lines.join('\n');
}
