/**
 * 确定性流程图生成（第一步）：tree-sitter 函数体 AST → 控制流图（CFG）。
 *
 * 动机：LLM 生成 mermaid 结构不稳定（幽灵节点/孤儿/断链，重试不收敛需人盯），
 * 改由代码确定性构建——结构上不可能产生 lint 缺陷（凡声明必有边、凡引用必声明、
 * 分支必汇合、是/否永不同目标）。标签一律取代码原文，清洗与发射见 flowchartEmitter.ts。
 *
 * 设计：片段组合式构建。每个子树返回 Frag{entry, exits:Pending[]}，
 * 父节点 wire(pendings, target) 统一接边并在多路汇合时惰性插入隐形汇合点。
 */
import type Parser from 'web-tree-sitter';
import { nodeText, type CondRegion } from '../parser/cParser.js';

export type CfgNodeKind =
  | 'start' | 'end'
  | 'stmt'      // 矩形：顺序语句
  | 'call'      // 双边矩形：纯调用语句
  | 'cond'      // 菱形：if/while/for/do 条件、switch 控制表达式
  | 'return'    // 矩形：return 原文，出边 → END
  | 'jump'      // 矩形：break/continue/goto
  | 'merge'     // 隐形汇合点（label 为一个空格）
  | 'block';    // 降级聚合块（原文摘要）

export interface CfgNode {
  seq: number;
  kind: CfgNodeKind;
  label: string;            // 未清洗代码原文（多语句节点以 \n 分隔，发射器转 <br>）
  rowFrom: number;          // 0-based 行（clean 源坐标系，与原始源行号一致）
  rowTo: number;
  spinOf?: number;          // merge 专用：自旋回环对应的菱形 seq（发射 id 取 D{k}_J）
  region?: number;          // 归属的体内 #if 区域（cfg.regions 下标，最内层）
  branch?: number;          // 区域内的分支下标（#if/#elif/#else 多路）
  dead?: boolean;           // 不可达代码（return/break 之后），发射时剔除
}

export interface CfgEdge {
  from: number;             // CfgNode.seq
  to: number;
  label?: string;           // 是/否/case 值/default/其他
  noArrow?: boolean;        // 自旋回环回边用 ---（renderScript _J 整形契约）
}

/** 可坍缩子树（大函数 >60 节点时聚合降级用）：if/循环/case 的完整分支体 */
export interface CollapseGroup {
  seqs: number[];           // 组内全部节点（含嵌套组）
  entrySeq: number;         // 组入口（外部入边唯一落点）
  summary: string;          // 首条语句原文摘要
}

export interface CondBranch {
  kind: 'if' | 'elif' | 'else';
  expr?: string;            // elif 的表达式原文
  from: number;             // 0-based 行区间（指令行的下一行起）
  to: number;               // 0-based 行区间（下一条指令行的前一行止）
}

export interface CondRegionInfo {
  macro: string;
  from: number;
  to: number;
  branches: CondBranch[];
  parent?: number;          // 直接包含本区域的区域下标（嵌套 #if）
}

export interface Cfg {
  nodes: CfgNode[];
  edges: CfgEdge[];
  startSeq: number;
  endSeq: number;
  regions: CondRegionInfo[];
  groups: CollapseGroup[];
  degraded: 'none' | 'subtree' | 'block';
  warnings: string[];
}

interface Pending { from: number; label?: string; noArrow?: boolean }
interface Frag { entry: number | null; exits: Pending[] }

type TSNode = Parser.SyntaxNode;

const EMPTY_FRAG: Frag = { entry: null, exits: [] };

/** 顺序语句 run 的最大合并条数（盒子行数上限，超出另起节点） */
const RUN_MAX = 6;
/** run 合并的物理行上限：多行语句（如跨行函数调用）一条就占数行，
 *  不看行数合并会让节点标签超 MAX_LINES 被截断、后续语句静默消失（v4 Startup 实测） */
const RUN_MAX_LINES = 8;

export interface BuildOptions {
  /** 全文件条件编译区域（preprocessSource 产出），用于体内 #if 归属 */
  condRegions?: CondRegion[];
  /** 原始行（含 # 指令行），用于 #elif/#else 多路切分 */
  originalLines?: string[];
  /** 函数定义节点行范围（0-based），过滤体内区域用 */
  fnRowFrom: number;
  fnRowTo: number;
}

/** 构建一个函数的 CFG。body 为 function_definition 的 body 字段节点（compound_statement） */
export function buildFnCfg(body: TSNode, source: string, opts: BuildOptions): Cfg {
  return new FnCfgBuilder(source, opts).build(body);
}

class FnCfgBuilder {
  nodes: CfgNode[] = [];
  edges: CfgEdge[] = [];
  groups: CollapseGroup[] = [];
  warnings: string[] = [];
  degraded: 'none' | 'subtree' | 'block' = 'none';
  regions: CondRegionInfo[] = [];

  private seqCounter = 0;
  private startSeq = -1;
  private endSeq = -1;
  /** 循环/开关上下文栈：break 作用于栈顶；continues 为 null 表示 switch（continue 穿透到外层循环） */
  private loopStack: { breaks: Pending[]; continues: Pending[] | null }[] = [];
  private labels = new Map<string, number>();
  private gotos: { from: number; name: string }[] = [];

  constructor(private source: string, private opts: BuildOptions) {
    // 区域切分只依赖 opts，提前到构造期：顺序 run 合并要在 #if 边界处断开
    this.setupRegions();
  }

  build(body: TSNode): Cfg {
    const start = this.mk('start', '开始', body.startPosition.row, body.startPosition.row);
    const end = this.mk('end', '结束', body.endPosition.row, body.endPosition.row);
    this.startSeq = start.seq;
    this.endSeq = end.seq;

    const frag = this.buildStatements(this.stmtChildren(body));
    if (frag.entry === null) {
      this.edge(start.seq, end.seq);
    } else {
      this.edge(start.seq, frag.entry);
      this.wire(frag.exits, end.seq);
    }

    // goto 二次回填
    for (const g of this.gotos) {
      const target = this.labels.get(g.name);
      if (target !== undefined) {
        this.edge(g.from, target);
      } else {
        this.warnings.push(`goto ${g.name} 找不到标签，已降级为直连结束`);
        this.degraded = 'subtree';
        this.edge(g.from, end.seq);
      }
    }

    // 不可达节点剔除（其关联边一并剔除）
    const dead = new Set(this.nodes.filter(n => n.dead).map(n => n.seq));
    if (dead.size > 0) {
      this.nodes = this.nodes.filter(n => !dead.has(n.seq));
      this.edges = this.edges.filter(e => !dead.has(e.from) && !dead.has(e.to));
      for (const g of this.groups) g.seqs = g.seqs.filter(s => !dead.has(s));
    }

    this.assignRegions();

    return {
      nodes: this.nodes, edges: this.edges,
      startSeq: this.startSeq, endSeq: this.endSeq,
      regions: this.regions, groups: this.groups,
      degraded: this.degraded, warnings: this.warnings,
    };
  }

  // ---------- 基础工具 ----------

  private mk(kind: CfgNodeKind, label: string, rowFrom: number, rowTo: number): CfgNode {
    const node: CfgNode = { seq: this.seqCounter++, kind, label, rowFrom, rowTo };
    this.nodes.push(node);
    return node;
  }

  private edge(from: number, to: number, label?: string, noArrow?: boolean): void {
    this.edges.push({ from, to, label, noArrow });
  }

  /** 菱形区域归属行取头部（关键字行 → 条件式末行），不取整语句——
   *  else 被 #endif 夹断的写法（Gp_EcuStpShdn_Startup L610-629 实测：if/else 链整语句
   *  横跨条件编译区边界）按整语句算会部分相交漏框，而菱形语义上只属于头部所在区域 */
  private headerRowTo(s: TSNode): number {
    const c = s.childForFieldName('condition');
    return c ? c.endPosition.row : s.startPosition.row;
  }

  /** 把若干挂起出边接到 target；多路时惰性插入隐形汇合点（汇合点保证有出边，lint ⑨ 构造性满足） */
  private wire(pendings: Pending[], target: number): void {
    if (pendings.length === 0) return;
    if (pendings.length === 1) {
      this.edge(pendings[0].from, target, pendings[0].label, pendings[0].noArrow);
      return;
    }
    const tNode = this.nodes.find(n => n.seq === target)!;
    const m = this.mk('merge', ' ', tNode.rowFrom, tNode.rowFrom);
    for (const p of pendings) this.edge(p.from, m.seq, p.label, p.noArrow);
    this.edge(m.seq, target);
  }

  private text(node: TSNode): string {
    return nodeText(node, this.source);
  }

  /** 条件表达式原文（剥外层括号） */
  private condText(cond: TSNode | null): string {
    if (!cond) return '';
    if (cond.type === 'parenthesized_expression' && cond.namedChildren[0]) {
      return this.text(cond.namedChildren[0]);
    }
    return this.text(cond);
  }

  /** 语句级 named children（剥注释；注释不进图） */
  private stmtChildren(node: TSNode): TSNode[] {
    return node.namedChildren.filter(c => c.type !== 'comment');
  }

  private isSimple(s: TSNode): boolean {
    return s.type === 'declaration' || s.type === 'expression_statement';
  }

  /** 登记可坍缩子树（大函数聚合降级用）；组内节点数 <2 不值得登记。summarySeq 指定摘要来源节点（默认入口） */
  private registerGroup(beforeCount: number, frag: Frag, summarySeq?: number): void {
    if (frag.entry === null) return;
    const seqs = this.nodes.slice(beforeCount).map(n => n.seq);
    if (seqs.length < 2) return;
    const sumNode = this.nodes.find(n => n.seq === (summarySeq ?? frag.entry));
    const summary = sumNode?.label.split('\n')[0] ?? '';
    this.groups.push({ seqs, entrySeq: frag.entry!, summary });
  }

  /** 行区间的最内层区域归属键（'区域:分支'）；区域内但夹断语句（部分相交）返回 '区域:' */
  private regionKey(rowFrom: number, rowTo: number): string {
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (rowFrom < r.from || rowTo > r.to - 1) continue;
      // 有更内层区域完全包含则让位最内层
      if (this.regions.some((c, ci) => ci !== i && c.from >= r.from && c.to <= r.to && rowFrom >= c.from && rowTo <= c.to - 1)) continue;
      for (let b = 0; b < r.branches.length; b++) {
        const br = r.branches[b];
        if (rowFrom >= br.from && rowTo <= br.to) return `${i}:${b}`;
      }
      return `${i}:`;
    }
    return '';
  }

  // ---------- 语句序列（含顺序 run 合并与不可达剔除） ----------

  private buildStatements(stmts: TSNode[]): Frag {
    let entry: number | null = null;
    let pendings: Pending[] = [];
    let run: TSNode[] = [];
    let runKey = '';
    let runLines = 0;
    let skipped = 0;

    const attachable = () => entry === null || pendings.length > 0;

    const attach = (frag: Frag): void => {
      if (frag.entry === null) return;
      if (entry === null) {
        entry = frag.entry;
        pendings = frag.exits;
        return;
      }
      this.wire(pendings, frag.entry);
      pendings = frag.exits;
    };

    const flushRun = (): void => {
      if (run.length === 0) return;
      if (attachable()) {
        const parts: TSNode[][] = [];
        for (let i = 0; i < run.length; i += RUN_MAX) parts.push(run.slice(i, i + RUN_MAX));
        for (const part of parts) attach(this.mkRunFrag(part));
      } else {
        skipped += run.length;
      }
      run = [];
      runLines = 0;
    };

    for (const s of stmts) {
      // 局部变量定义一律不进图（用户 09-17 定调：定义无流程语义，= 0U / = &buf / = GetTime() 同为噪音；
      // 真正生效的赋值/调用是独立 expression_statement，不受影响；for 初始化器走 buildFor 也不受影响）
      if (s.type === 'declaration') continue;
      if (this.isSimple(s)) {
        if (!attachable()) { skipped++; continue; }
        // run 合并在 #if 区域归属变化处断开（跨边界的合并节点无法完整归属任何虚线框）
        const key = this.regionKey(s.startPosition.row, s.endPosition.row);
        if (run.length > 0 && key !== runKey) flushRun();
        // 物理行数超限也断开（多行语句独占节点，防标签截断吞语句）
        const sLines = s.endPosition.row - s.startPosition.row + 1;
        if (run.length > 0 && (runLines + sLines > RUN_MAX_LINES || sLines > 1)) flushRun();
        if (run.length === 0) { runKey = key; runLines = 0; }
        runLines += sLines;
        run.push(s);
        if (sLines > 1) flushRun(); // 多行语句独占节点（跨行调用排他后仍是纯调用 → [[]] 双边矩形）
        continue;
      }
      flushRun();
      // 标签语句可能是 goto 的目标：即使直线流程在此中断也必须构建（入边由 goto 回填）
      if (s.type === 'labeled_statement') {
        const frag = this.buildStatement(s);
        if (frag.entry !== null) {
          if (entry === null) entry = frag.entry;
          else if (pendings.length > 0) this.wire(pendings, frag.entry);
          pendings = frag.exits;
        }
        continue;
      }
      if (!attachable()) { skipped++; continue; }
      attach(this.buildStatement(s));
    }
    flushRun();

    if (skipped > 0) {
      this.warnings.push(`return/break 之后的不可达代码已省略 ${skipped} 条语句`);
    }
    return { entry, exits: pendings };
  }

  /** 连续普通语句合并为一个节点；单句且为纯调用时用双边矩形 */
  private mkRunFrag(stmts: TSNode[]): Frag {
    const label = stmts.map(s => this.text(s).replace(/;\s*$/, '')).join('\n');
    let kind: CfgNodeKind = 'stmt';
    if (stmts.length === 1 && stmts[0].type === 'expression_statement') {
      const inner = this.stmtChildren(stmts[0])[0];
      if (inner && inner.type === 'call_expression') kind = 'call';
    }
    const node = this.mk(kind, label, stmts[0].startPosition.row, stmts[stmts.length - 1].endPosition.row);
    return { entry: node.seq, exits: [{ from: node.seq }] };
  }

  // ---------- 单条语句分派 ----------

  private buildStatement(s: TSNode): Frag {
    switch (s.type) {
      case 'compound_statement':
        return this.buildStatements(this.stmtChildren(s));
      case 'if_statement':
        return this.buildIf(s);
      case 'while_statement':
        return this.buildWhile(s);
      case 'do_statement':
        return this.buildDo(s);
      case 'for_statement':
        return this.buildFor(s);
      case 'switch_statement':
        return this.buildSwitch(s);
      case 'return_statement': {
        const node = this.mk('return', this.text(s).replace(/;\s*$/, ''), s.startPosition.row, s.endPosition.row);
        this.edge(node.seq, this.endSeq);
        return { entry: node.seq, exits: [] };
      }
      case 'break_statement':
      case 'continue_statement': {
        const isBreak = s.type === 'break_statement';
        const node = this.mk('jump', isBreak ? 'break' : 'continue', s.startPosition.row, s.endPosition.row);
        const ctx = isBreak
          ? this.loopStack[this.loopStack.length - 1]
          : [...this.loopStack].reverse().find(c => c.continues !== null);
        if (!ctx) {
          this.warnings.push(`${isBreak ? 'break' : 'continue'} 不在循环/switch 内，已降级为顺序语句`);
          this.degraded = 'subtree';
          return { entry: node.seq, exits: [{ from: node.seq }] };
        }
        (isBreak ? ctx.breaks : ctx.continues!).push({ from: node.seq });
        return { entry: node.seq, exits: [] };
      }
      case 'goto_statement': {
        const labelNode = s.childForFieldName('label');
        const name = labelNode ? this.text(labelNode) : '?';
        const node = this.mk('jump', `goto ${name}`, s.startPosition.row, s.endPosition.row);
        this.gotos.push({ from: node.seq, name });
        return { entry: node.seq, exits: [] };
      }
      case 'labeled_statement': {
        const labelNode = s.childForFieldName('label');
        const inner = this.stmtChildren(s).find(c => c.type !== 'statement_identifier');
        if (!inner) return EMPTY_FRAG;
        const frag = this.buildStatement(inner);
        if (labelNode && frag.entry !== null) this.labels.set(this.text(labelNode), frag.entry);
        return frag;
      }
      case 'declaration':
        return EMPTY_FRAG; // 定义不进图（见 buildStatements 同名过滤）
      case 'expression_statement':
        return this.mkRunFrag([s]);
      case 'empty_statement':
        return EMPTY_FRAG;
      default: {
        // 未识别构造/语法错误：子树降级为原文块，骨架不断
        const node = this.mk('block', this.text(s), s.startPosition.row, s.endPosition.row);
        this.warnings.push(`未识别构造 ${s.type}，已降级为原文块`);
        this.degraded = 'subtree';
        return { entry: node.seq, exits: [{ from: node.seq }] };
      }
    }
  }

  /** consequence/body 可能是复合语句或单条语句 */
  private buildBodyFrag(node: TSNode | null): Frag {
    if (!node) return EMPTY_FRAG;
    if (node.type === 'compound_statement') return this.buildStatements(this.stmtChildren(node));
    return this.buildStatement(node);
  }

  // ---------- 各控制结构 ----------

  private buildIf(s: TSNode): Frag {
    const beforeWhole = this.nodes.length; // 整语句坍缩组（含菱形）登记起点
    const d = this.mk('cond', this.condText(s.childForFieldName('condition')), s.startPosition.row, this.headerRowTo(s));

    const beforeThen = this.nodes.length;
    const thenFrag = this.buildBodyFrag(s.childForFieldName('consequence'));
    this.registerGroup(beforeThen, thenFrag);

    const alt = s.childForFieldName('alternative'); // else_clause
    const elseInner = alt ? this.stmtChildren(alt)[0] : null; // else if → if_statement（递归成链）；else → compound
    const beforeElse = this.nodes.length;
    const elseFrag = elseInner ? this.buildBodyFrag(elseInner) : EMPTY_FRAG;
    if (elseInner) this.registerGroup(beforeElse, elseFrag);

    // 双分支均空的退化 if（如 if (a);）→ 降级为普通矩形，避免无意义菱形
    if (thenFrag.entry === null && elseFrag.entry === null && !elseInner) {
      d.kind = 'stmt';
      d.label = this.text(s).replace(/;\s*$/, '');
      this.registerGroup(beforeWhole, { entry: d.seq, exits: [] }, d.seq);
      return { entry: d.seq, exits: [{ from: d.seq }] };
    }

    // 空分支补隐形汇合点占位：是/否 永不同目标（lint ④ 构造性保证）
    let thenEntry = thenFrag.entry;
    let thenExits = thenFrag.exits;
    if (thenEntry === null) {
      const m = this.mk('merge', ' ', s.startPosition.row, s.startPosition.row);
      thenEntry = m.seq;
      thenExits = [{ from: m.seq }];
    }
    this.edge(d.seq, thenEntry, '是');

    let elseExits: Pending[];
    if (elseInner) {
      let elseEntry = elseFrag.entry;
      elseExits = elseFrag.exits;
      if (elseEntry === null) {
        const m = this.mk('merge', ' ', s.startPosition.row, s.startPosition.row);
        elseEntry = m.seq;
        elseExits = [{ from: m.seq }];
      }
      this.edge(d.seq, elseEntry, '否');
    } else {
      elseExits = [{ from: d.seq, label: '否' }];
    }

    this.registerGroup(beforeWhole, { entry: d.seq, exits: [] }, d.seq);
    return { entry: d.seq, exits: [...thenExits, ...elseExits] };
  }

  private buildWhile(s: TSNode): Frag {
    const beforeWhole = this.nodes.length;
    const d = this.mk('cond', this.condText(s.childForFieldName('condition')), s.startPosition.row, this.headerRowTo(s));
    const body = s.childForFieldName('body');
    const stmts = body && body.type === 'compound_statement' ? this.stmtChildren(body) : body ? [body] : [];

    if (stmts.length === 0) {
      // 空体自旋等待：严格按 renderScript _J 整形契约 PRE-->J / J-->W / W---J
      const j = this.mk('merge', ' ', s.startPosition.row, s.startPosition.row);
      j.spinOf = d.seq;
      this.edge(j.seq, d.seq);
      this.edge(d.seq, j.seq, undefined, true); // 回边无箭头
      this.registerGroup(beforeWhole, { entry: j.seq, exits: [] }, d.seq);
      return { entry: j.seq, exits: [{ from: d.seq, label: '否' }] };
    }

    this.loopStack.push({ breaks: [], continues: [] });
    const before = this.nodes.length;
    const bodyFrag = this.buildStatements(stmts);
    this.registerGroup(before, bodyFrag);
    const ctx = this.loopStack.pop()!;

    if (bodyFrag.entry !== null) {
      this.edge(d.seq, bodyFrag.entry, '是');
      this.wire(bodyFrag.exits, d.seq); // 回边：循环体出口回条件
    } else {
      this.warnings.push('while 循环体为空（仅注释），已按空体处理');
    }
    this.wire(ctx.continues ?? [], d.seq);
    this.registerGroup(beforeWhole, { entry: d.seq, exits: [] }, d.seq);
    return { entry: d.seq, exits: [{ from: d.seq, label: '否' }, ...ctx.breaks] };
  }

  private buildDo(s: TSNode): Frag {
    const beforeWhole = this.nodes.length;
    const body = s.childForFieldName('body');
    const stmts = body && body.type === 'compound_statement' ? this.stmtChildren(body) : body ? [body] : [];

    this.loopStack.push({ breaks: [], continues: [] });
    const before = this.nodes.length;
    const bodyFrag = this.buildStatements(stmts);
    this.registerGroup(before, bodyFrag);
    const ctx = this.loopStack.pop()!;

    const d = this.mk('cond', this.condText(s.childForFieldName('condition')), s.startPosition.row, this.headerRowTo(s));
    if (bodyFrag.entry !== null) {
      this.wire(bodyFrag.exits, d.seq);
      this.edge(d.seq, bodyFrag.entry, '是'); // 回边
    } else {
      this.warnings.push('do-while 循环体为空，已按空体处理');
    }
    this.wire(ctx.continues ?? [], d.seq);
    const doEntry = bodyFrag.entry ?? d.seq;
    this.registerGroup(beforeWhole, { entry: doEntry, exits: [] }, d.seq);
    return { entry: doEntry, exits: [{ from: d.seq, label: '否' }, ...ctx.breaks] };
  }

  private buildFor(s: TSNode): Frag {
    const beforeWhole = this.nodes.length;
    const init = s.childForFieldName('initializer');
    let initSeq: number | null = null;
    if (init) {
      const n = this.mk('stmt', this.text(init).replace(/;\s*$/, ''), init.startPosition.row, init.endPosition.row);
      initSeq = n.seq;
    }

    const condNode = s.childForFieldName('condition');
    const d = this.mk('cond', condNode ? this.condText(condNode) : 'for (;;)', s.startPosition.row, this.headerRowTo(s));
    if (initSeq !== null) this.edge(initSeq, d.seq);

    const body = s.childForFieldName('body');
    const stmts = body && body.type === 'compound_statement' ? this.stmtChildren(body) : body ? [body] : [];
    this.loopStack.push({ breaks: [], continues: [] });
    const before = this.nodes.length;
    const bodyFrag = this.buildStatements(stmts);
    this.registerGroup(before, bodyFrag);
    const ctx = this.loopStack.pop()!;

    const upd = s.childForFieldName('update');
    let updSeq: number | null = null;
    if (upd) {
      const n = this.mk('stmt', this.text(upd), upd.startPosition.row, upd.endPosition.row);
      updSeq = n.seq;
    }

    if (bodyFrag.entry !== null) {
      this.edge(d.seq, bodyFrag.entry, '是');
      this.wire(bodyFrag.exits, updSeq ?? d.seq);
    }
    if (updSeq !== null) this.edge(updSeq, d.seq);
    this.wire(ctx.continues ?? [], updSeq ?? d.seq);

    const exits: Pending[] = [];
    if (condNode) exits.push({ from: d.seq, label: '否' }); // for(;;) 无否支，唯一出口是 break
    exits.push(...ctx.breaks);
    this.registerGroup(beforeWhole, { entry: initSeq ?? d.seq, exits: [] }, d.seq);
    return { entry: initSeq ?? d.seq, exits };
  }

  private buildSwitch(s: TSNode): Frag {
    const beforeWhole = this.nodes.length;
    const d = this.mk('cond', `switch (${this.condText(s.childForFieldName('condition'))})`, s.startPosition.row, this.headerRowTo(s));
    const body = s.childForFieldName('body');
    const children = body ? this.stmtChildren(body) : [];
    const cases = children.filter(c => c.type === 'case_statement');
    if (cases.length !== children.length) {
      this.warnings.push('switch 体内存在 case 之外的语句，已忽略');
    }

    // switch 不压循环栈的 continues（C 语义：switch 内 continue 属外层循环），只收集自己的 break
    this.loopStack.push({ breaks: [], continues: null });

    let fallthrough: Pending[] = []; // 上一 case 体未遇 break 的落空出口（顺序跌入下一 case）
    let hasDefault = false;
    for (const cs of cases) {
      const value = cs.childForFieldName('value');
      const label = value ? `case ${this.text(value)}` : 'default';
      if (!value) hasDefault = true;
      // web-tree-sitter 的 SyntaxNode 包装对象不保证引用相等，按区间比较剔除 value 节点
      const stmts = this.stmtChildren(cs).filter(c => c.startIndex !== value?.startIndex);
      const before = this.nodes.length;
      const frag = stmts.length > 0 ? this.buildStatements(stmts) : EMPTY_FRAG;
      this.registerGroup(before, frag);
      if (frag.entry === null) {
        // 空 case：D 的入边暂存，与后续 fallthrough 一起挂到下一个非空 case
        fallthrough.push({ from: d.seq, label });
        continue;
      }
      this.wire([...fallthrough, { from: d.seq, label }], frag.entry);
      fallthrough = frag.exits;
    }
    const ctx = this.loopStack.pop()!;

    const exits: Pending[] = [...fallthrough, ...ctx.breaks];
    if (!hasDefault) exits.push({ from: d.seq, label: '其他' });
    this.registerGroup(beforeWhole, { entry: d.seq, exits: [] }, d.seq);
    return { entry: d.seq, exits };
  }

  // ---------- 条件编译区域（#if 归属） ----------

  /** 过滤体内区域并切分 #elif/#else 多路分支、建立嵌套父子关系 */
  private setupRegions(): void {
    const raw = (this.opts.condRegions ?? []).filter(
      r => r.from > this.opts.fnRowFrom && r.to <= this.opts.fnRowTo,
    );
    const lines = this.opts.originalLines ?? [];
    this.regions = raw.map(r => ({ macro: r.macro, from: r.from, to: r.to, branches: this.splitBranches(r, lines) }));
    // 外层优先（from 升、to 降）：condRegions 是弹栈序（内层在前），排序后 SG 编号从外到内直观稳定
    this.regions.sort((a, b) => a.from - b.from || b.to - a.to);

    // 父子：严格包含本区域的最小区域
    for (let i = 0; i < this.regions.length; i++) {
      let parent = -1;
      for (let j = 0; j < this.regions.length; j++) {
        if (i === j) continue;
        const p = this.regions[j], c = this.regions[i];
        if (p.from <= c.from && p.to >= c.to && (p.from !== c.from || p.to !== c.to)) {
          if (parent === -1 || (this.regions[parent].from <= p.from && this.regions[parent].to >= p.to)) parent = j;
        }
      }
      if (parent !== -1) this.regions[i].parent = parent;
    }
  }

  /** 在 originalLines 的区域内按相对深度重扫 #elif/#else 切分支（cParser 的 CondRegion 不切多路） */
  private splitBranches(r: CondRegion, lines: string[]): CondBranch[] {
    // 收集区域自身层级（相对深度 1）的 #elif/#else 指令行
    const cuts: { kind: 'elif' | 'else'; line: number }[] = [];
    let depth = 0;
    for (let i = r.from - 1; i <= r.to && i < lines.length; i++) {
      const t = lines[i]?.trim() ?? '';
      if (/^#\s*(?:ifdef|ifndef|if)\b/.test(t)) { depth++; continue; }
      if (/^#\s*endif\b/.test(t)) { depth--; continue; }
      if (depth === 1) {
        if (/^#\s*elif\b/.test(t)) cuts.push({ kind: 'elif', line: i });
        else if (/^#\s*else\b/.test(t)) cuts.push({ kind: 'else', line: i });
      }
    }
    const out: CondBranch[] = [];
    let from = r.from; // 首路从 #if 下一行起
    for (let k = 0; k <= cuts.length; k++) {
      const isLast = k === cuts.length;
      const to = isLast ? r.to - 1 : cuts[k].line - 1;
      out.push({ kind: k === 0 ? 'if' : cuts[k - 1].kind, from, to });
      from = cuts[k]?.line !== undefined ? cuts[k].line + 1 : from;
    }
    return out;
  }

  /** 节点按行区间归属最内层区域的分支；只挂完全包含，夹断语句（部分相交）不挂框 */
  private assignRegions(): void {
    if (this.regions.length === 0) return;
    for (const n of this.nodes) {
      if (n.kind === 'start' || n.kind === 'end') continue;
      const m = this.regionKey(n.rowFrom, n.rowTo).match(/^(\d+):(\d+)$/);
      if (m) {
        n.region = Number(m[1]);
        n.branch = Number(m[2]);
      }
    }
  }
}

/**
 * 大函数降级（对齐 callGraphs CG_MAX_NODES=60 先例）：迭代坍缩最小可坍缩子树
 * （if/循环/case 的完整分支体）为 block 矩形，直至节点数 ≤ maxNodes。
 * 坍缩顺序从小到大 → 外层控制流骨架（菱形/回边）保留，牺牲最深层细节。
 */
export function collapseCfg(cfg: Cfg, maxNodes = 60): Cfg {
  const liveNodes = () => cfg.nodes.filter(n => !n.dead);
  let nextSeq = Math.max(...cfg.nodes.map(n => n.seq)) + 1;
  while (liveNodes().length > maxNodes) {
    const liveSeqs = new Set(liveNodes().map(n => n.seq));
    // ≥2 节点才值得坍缩（1 节点坍缩无净减量，会死循环）；seqs 为空 = 已消费
    const candidates = cfg.groups
      .filter(g => g.seqs.length >= 2 && g.seqs.every(s => liveSeqs.has(s)))
      .sort((a, b) => a.seqs.length - b.seqs.length);
    if (candidates.length === 0) {
      cfg.warnings.push(`节点数 ${liveNodes().length} 超上限 ${maxNodes} 但无可坍缩子树，按原样输出`);
      break;
    }
    const g = candidates[0];
    const gCount = g.seqs.length;
    const members = new Set(g.seqs);
    const memberNodes = cfg.nodes.filter(n => members.has(n.seq));
    const rowFrom = Math.min(...memberNodes.map(n => n.rowFrom));
    const rowTo = Math.max(...memberNodes.map(n => n.rowTo));
    const stmtCount = memberNodes.reduce((w, n) => w + n.label.split('\n').length, 0);
    const block: CfgNode = {
      seq: nextSeq++,
      kind: 'block',
      label: `${g.summary}\n…（共 ${stmtCount} 条语句）`,
      rowFrom, rowTo,
    };
    // 区域归属：成员同区域同分支才继承（留在原虚线框内），否则挂顶层
    const r0 = memberNodes[0]?.region;
    const b0 = memberNodes[0]?.branch;
    if (memberNodes.every(n => n.region === r0 && n.branch === b0)) {
      block.region = r0;
      block.branch = b0;
    }
    cfg.nodes.push(block);

    // 重接边：内部边删除；外部入边/出边改挂 block（按 from,to,label 去重）
    const seen = new Set<string>();
    const newEdges: CfgEdge[] = [];
    for (const e of cfg.edges) {
      const inFrom = members.has(e.from);
      const inTo = members.has(e.to);
      if (inFrom && inTo) continue;
      const ne: CfgEdge = { ...e };
      if (inFrom) ne.from = block.seq;
      if (inTo) ne.to = block.seq;
      if (ne.from === ne.to) continue; // 入边落点恰是出口（退化）→ 自环删除
      const key = `${ne.from}->${ne.to}|${ne.label ?? ''}|${ne.noArrow ? 1 : 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      newEdges.push(ne);
    }
    cfg.edges = newEdges;

    for (const n of cfg.nodes) if (members.has(n.seq)) n.dead = true;
    // 组修正：被坍缩组标记已消费；包含其成员的外层组把成员换成 block（整语句组随分支坍缩保持可再坍缩）
    for (const og of cfg.groups) {
      if (og === g) { og.seqs = []; continue; }
      if (!og.seqs.some(s => members.has(s))) continue;
      og.seqs = og.seqs.filter(s => !members.has(s));
      if (members.has(og.entrySeq)) og.entrySeq = block.seq;
      og.seqs.push(block.seq);
    }
    cfg.warnings.push(`大函数坍缩：「${g.summary}」等 ${gCount} 个节点聚合为块`);
    cfg.degraded = 'block';
  }
  return cfg;
}
