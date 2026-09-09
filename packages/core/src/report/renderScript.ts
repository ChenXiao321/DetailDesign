/**
 * Mermaid 浏览器端渲染脚本（评审报告与 Polarion 单图渲染页共用，从 htmlReport.ts 抽取，内容零改动）。
 * 返回三段 <script>：mermaid.initialize（全局默认配置，概览图等可用 %%{init}%% 单图覆盖）、
 * ORTHO 直角折线后处理（穿盒/穿边/方向硬闸 + 两遍选路 + 标签重挂 + 贴形/贴缘修饰）。
 * 前提：mermaid.min.js 已打补丁（_patch_curve.js，共 4 处），且先于本脚本注入页面。
 */
export function mermaidRenderScript(): string {
  return `<script>mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral', themeVariables: { fontSize: '13px' }, flowchart: { useMaxWidth: false, padding: 6, rankSpacing: 36, nodeSpacing: 24 }, sequence: { showSequenceNumbers: true } });</script>
<script>
// 直角折线后处理。前提：mermaid.min.js 已打补丁（_patch_curve.js），边按 dagre 路径点输出折线。
// 这里把每条边规范化为横平竖直且最多拐两次。端部斜线段的方向不可靠（dagre 在跨层时给出
// 斜线，横竖占比接近时方向会判错），所以不按出边/入边方向套固定模板，而是生成全部
// 候选直角路由（一拐两种 + 两拐横竖干线各取端点中点/dagre中间点中位数），按“dagre 原始
// 路径点到候选路由的距离平方和”选最贴合的一条——dagre 的干线走节点间空隙，贴住它就不会
// 像端点中点法那样把干线折进节点列（D1--否-->END 被截断），也不会判错先行方向
// （D2--否-->I 被判成先竖后横，竖线直接穿过 P 节点框）。
// 两道硬闸（拟合分不能凌驾其上）：
// ① 穿盒淘汰：候选任一段穿过其他节点包围盒（2px 缩边 AABB）即淘汰，选优优先级
//    “方向合规且不穿盒 > 任意不穿盒 > 方向合规 > 任意”——D1--否-->END 曾拟合出
//    干线 x=129 竖穿「读 InitCheckRslt」盒（拟合分最低但线穿节点，用户截图发现）。
// ② 箭头朝向约束：从边 id 找到目标节点，端点贴在哪条边上，末段就必须沿该边法线
// （顶/底边竖直进▼、左右边水平进）——方向不符的候选直接淘汰，只在方向正确的候选里
// 按拟合度选优，否则会选出横着扎进顶边的躺平箭头（P-->I 进 Cnt_u32加1 顶边、
// D1--否-->C3 横进 SwitchToRunPhase 顶边）。端点落在角部（顶/底边与侧边距离相近）时
// 按来源方位决策：矩形族节点 + 来源在角侧盒外 + 该侧边无其他入边 → 端点平移到侧缘横进，
// 但仅当平移后存在不穿盒不穿边的横进候选才采用，否则竖直进；菱形等 polygon 节点不平移。
// ③ 穿边避让：选路优先级为字典序「不穿盒 > 方向合规 > 不穿其他边 > 拟合分」——候选与已
// 定稿边的当前路由严格交叉（_xcheck 同口径）即降级；候选不够时两轮扩容（被穿盒的盒缘外
// 8px 加干线、被穿越段的端点外 8px 加干线）；仍不干净且 dagre 原始路由干净则保留原始斜线
// 不直角化。TLF35584 密集图曾批量出现兄弟边互相交叉（N5-->N6 干线贴 N5 顶边与 N5-->N7
// 角部拐弯相撞）、两点直线早退把 dagre 绕行路线拉成竖穿节点盒（D2-->END 竖穿 B2）。
// ③b 目标盒穿透：穿盒检查排除了目标盒自身（箭尖总要触边），但竖干线落在矩形族目标盒
// 跨度内会穿盒而入、末段连箭头埋在节点填充下（RtSetMode 图 W2-->END 秃线）——候选在终点
// 前不得进入目标盒 2px 缩边内部，否决并入「不穿盒」档，扩容①同时加目标盒缘外 8px 干线。
// 选定后两件收尾：
// ④ 端点贴形：贴边（≤12px）端点的箭头尖贴到盒边——dagre 按原始斜向求的交点在直角化后
//    会悬空（D1-->END 尖浮在「结束」胶囊左肩外 6px）；进点坐标卡进盒跨距（胶囊留 rx
//    平直段，普通矩形也卡 2px 级悬空），两点直线被夹出拐点时插入拐点。
// ⑤ 标签重挂：边标签投影到原路径取弧长占比，平移到新路径同占比处——否则路由大改后
//    标签留在旧干线旁（D1--否-->END 的「否」字离新线 87px）。
window.addEventListener('DOMContentLoaded', async () => {
  // 单图语法错误时 mermaid.run 会 reject（其余图已照常渲染成 error 占位 svg），
  // 不 catch 的话后面 ORTHO 直角化整段不执行，全报告退化为 dagre 斜线（Qwen 批次实测踩中，
  // 且 unhandled rejection 不触发 window.onerror，调试页 __errs 抓不到）。
  try { await mermaid.run({ querySelector: '.mermaid' }); } catch (e) { /* 继续直角化已渲染的图 */ }
  // 调试钩子：file URL 带 #debug-orig 时把 dagre 原始路径存到 data-orig，供离线比对直角化改动
  if (location.hash === '#debug-orig')
    document.querySelectorAll('svg path.flowchart-link').forEach((p) => {
      if (p.getAttribute('d')) p.setAttribute('data-orig', p.getAttribute('d'));
    });
  // 隐形汇合点坍缩（prompt 规则11约定：空标签 + fill/stroke 全透明的节点是分支汇合点）。
  // mermaid 把它排成 ~24x12 的隐形矩形，各入边箭头散落在隐形框的不同边上，看起来像
  // 「箭头指向空气」（EcuStp Mainfunction 的 MERGE1 三汇入、Startup 的 M2_NORMAL_FLOW
  // 两汇入，用户两次截图反馈）。这里把汇合点 rect 清零——getBBox/离线审计看到的包围盒
  // 随之坍缩成中心点，选路时入边端点直接取中心点——并在中心画一个小实心圆点
  // （UML 汇流点画法），多支箭头汇聚于一点。检测靠内联样式（mermaid 把 style 语句
  // 内联成 fill:transparent !important），空标签但无透明样式的节点不动（可见小空盒，
  // 保持原行为）。圆点挂在节点 g 的父级（svg 坐标系），不进 g——保证 getBBox 仍为 0。
  document.querySelectorAll('svg').forEach((svg) => {
    svg.querySelectorAll('g.node[id^="flowchart-"]').forEach((g) => {
      const m = g.getAttribute('id').match(/^flowchart-(.+)-\\d+$/);
      if (!m || g.textContent.trim() !== '') return;
      const shape = g.querySelector('rect,polygon,circle,ellipse,path');
      const st = (shape && shape.getAttribute('style')) || '';
      if (!/fill:\\s*transparent/.test(st) || !/stroke:\\s*transparent/.test(st)) return;
      const t = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      if (!t) return;
      shape.setAttribute('x', '0'); shape.setAttribute('y', '0');
      shape.setAttribute('width', '0'); shape.setAttribute('height', '0');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', t[1]); dot.setAttribute('cy', t[2]);
      dot.setAttribute('r', '3.2'); dot.setAttribute('fill', '#333');
      dot.setAttribute('class', 'junction-dot');
      dot.setAttribute('data-junction', m[1]);
      g.parentNode.appendChild(dot);
    });
  });
  const median = (vals) => { const v = [...vals].sort((a, b) => a - b); return v[v.length >> 1]; };
  const round2 = (n) => Math.round(n * 100) / 100;
  const distToSeg = (p, a, b) => {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const wx = p[0] - a[0], wy = p[1] - a[1];
    const len2 = vx * vx + vy * vy;
    let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + t * vx - p[0], a[1] + t * vy - p[1]);
  };
  const fitScore = (route, pts) => {
    let s = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      let d = Infinity;
      for (let j = 0; j < route.length - 1; j++) d = Math.min(d, distToSeg(pts[i], route[j], route[j + 1]));
      s += d * d;
    }
    return s;
  };
  // 各 svg 的节点包围盒缓存（getBBox 本地坐标 + 自身 translate）
  const boxCache = new Map();
  const boxesOf = (svg) => {
    if (boxCache.has(svg)) return boxCache.get(svg);
    const map = {};
    svg.querySelectorAll('g.node[id^="flowchart-"]').forEach((g) => {
      const m = g.getAttribute('id').match(/^flowchart-(.+)-\\d+$/);
      const t = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      if (!m || !t) return;
      const b = g.getBBox();
      map[m[1]] = { x: b.x + +t[1], y: b.y + +t[2], w: b.width, h: b.height };
    });
    boxCache.set(svg, map);
    return map;
  };
  // 各 svg 的入边占边缓存：目标节点 id → [{id, side}]（按各入边端点的最近边归边，≤12px 才算占）
  const occCache = new Map();
  const occOf = (svg) => {
    if (occCache.has(svg)) return occCache.get(svg);
    const boxes = boxesOf(svg);
    const occ = {};
    svg.querySelectorAll('path.flowchart-link').forEach((p) => {
      const id = p.getAttribute('id') || '';
      const em = id.match(/^L_(.+)_\\d+$/);
      const d = p.getAttribute('d');
      if (!em || !d) return;
      const q = [...d.matchAll(/([\\d.]+),([\\d.]+)/g)].map((n) => [+n[1], +n[2]]);
      if (q.length < 2) return;
      const core = em[1];
      for (let i = 1; i < core.length - 1; i++) {
        if (core[i] !== '_') continue;
        const tBox = boxes[core.slice(i + 1)];
        if (!boxes[core.slice(0, i)] || !tBox) continue;
        const E = q[q.length - 1];
        const ds = [
          ['T', distToSeg(E, [tBox.x, tBox.y], [tBox.x + tBox.w, tBox.y])],
          ['B', distToSeg(E, [tBox.x, tBox.y + tBox.h], [tBox.x + tBox.w, tBox.y + tBox.h])],
          ['L', distToSeg(E, [tBox.x, tBox.y], [tBox.x, tBox.y + tBox.h])],
          ['R', distToSeg(E, [tBox.x + tBox.w, tBox.y], [tBox.x + tBox.w, tBox.y + tBox.h])],
        ].sort((a, b) => a[1] - b[1]);
        if (ds[0][1] <= 12) (occ[core.slice(i + 1)] = occ[core.slice(i + 1)] || []).push({ id, side: ds[0][0] });
        break;
      }
    });
    occCache.set(svg, occ);
    return occ;
  };
  const dirOf = (c) => {
    const a = c[c.length - 2], b = c[c.length - 1];
    return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'H' : 'V';
  };
  // 候选路由穿盒检查：任一段与其他节点包围盒（2px 缩边 AABB）相交即算穿盒（源/目标自身除外）
  const crossBoxesOf = (boxes, srcId, dstId) => (cand) => {
    const hit = [];
    for (let i = 0; i < cand.length - 1; i++) {
      const a = cand[i], b = cand[i + 1];
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
      const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
      for (const id in boxes) {
        if (id === srcId || id === dstId) continue;
        const bx = boxes[id];
        if (x1 < bx.x + bx.w - 2 && x2 > bx.x + 2 && y1 < bx.y + bx.h - 2 && y2 > bx.y + 2) hit.push(id);
      }
    }
    return hit;
  };
  // 目标盒穿透检查（仅矩形族目标用——菱形/平行四边形斜边端点本就在包围盒内部，会误判）：
  // 路径在终点前不得进入目标盒 2px 缩边内部。穿盒检查把目标盒自身排除了（箭尖总要触边），
  // 但竖干线落在目标盒 x 跨度内时会穿盒而入，末段连箭头一起埋在节点填充下面——
  // TLF35584 RtSetMode 图 W2-->END：干线 x=444.61 ∈「结束」盒 x 跨度 [423.86,462.24]，
  // 箭头被盖成秃线（用户截图反馈"有条线没有箭头"）。段与开盒相交用 slab 法。
  const penInto = (box) => (cand) => {
    const x1 = box.x + 2, x2 = box.x + box.w - 2, y1 = box.y + 2, y2 = box.y + box.h - 2;
    for (let i = 0; i < cand.length - 1; i++) {
      const a = cand[i], b = cand[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-9) { if (a[0] <= x1 || a[0] >= x2) continue; }
      else {
        let ta = (x1 - a[0]) / dx, tb = (x2 - a[0]) / dx;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 >= t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (a[1] <= y1 || a[1] >= y2) continue; }
      else {
        let ta = (y1 - a[1]) / dy, tb = (y2 - a[1]) / dy;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 >= t1) continue;
      }
      return true;
    }
    return false;
  };
  // 段-段严格交叉：与 _xcheck.js 同口径（0.6 容差、平行/共线跳过、一横一竖才算；
  // 斜线段按首端点近似为横段——dagre 原始斜线基本不参与判定，这也与 _xcheck 一致）
  const segX = (p1, p2, q1, q2) => {
    const aVert = Math.abs(p1[0] - p2[0]) < 0.6, bVert = Math.abs(q1[0] - q2[0]) < 0.6;
    if (aVert === bVert) return false;
    const vv = aVert ? [p1, p2] : [q1, q2], hh = aVert ? [q1, q2] : [p1, p2];
    const vx = vv[0][0], hy = hh[0][1];
    return hy > Math.min(vv[0][1], vv[1][1]) + 0.6 && hy < Math.max(vv[0][1], vv[1][1]) - 0.6 &&
           vx > Math.min(hh[0][0], hh[1][0]) + 0.6 && vx < Math.max(hh[0][0], hh[1][0]) - 0.6;
  };
  const bboxOf = (pts) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const q of pts) { if (q[0] < x1) x1 = q[0]; if (q[0] > x2) x2 = q[0]; if (q[1] < y1) y1 = q[1]; if (q[1] > y2) y2 = q[1]; }
    return { x1, y1, x2, y2 };
  };
  // 各 svg 的边路由登记表（自旋整形之后、主循环之中惰性建立）：候选选路时避让其他边的当前
  // 路由——先定稿的边先入库，后处理的边避开它们；每条边定稿后回写自己的新路由。TLF35584
  // 密集图曾批量出现兄弟边拟合后互相交叉（N5-->N6 干线贴 N5 顶边与 N5-->N7 角部拐弯相撞），
  // 只因选路只看盒不看边。
  const routeCache = new Map();
  const routesOf = (svg) => {
    if (routeCache.has(svg)) return routeCache.get(svg);
    const reg = { list: [], byEl: new Map() };
    const boxes = boxesOf(svg);
    svg.querySelectorAll('path.flowchart-link').forEach((p) => {
      const d = p.getAttribute('d');
      if (!d) return;
      const pts = [];
      (d.match(/[A-Za-z][^A-Za-z]*/g) || []).forEach((seg) => {
        const nums = seg.slice(1).trim().split(/[ ,]+/).filter(Boolean).map(Number);
        if (nums.length >= 2) pts.push([nums[nums.length - 2], nums[nums.length - 1]]);
      });
      if (pts.length < 2) return;
      const id = p.getAttribute('id') || '';
      let srcId = null, dstId = null;
      const em = id.match(/^L_(.+)_\d+$/);
      if (em) {
        const core = em[1];
        for (let i = 1; i < core.length - 1; i++) {
          if (core[i] !== '_') continue;
          if (boxes[core.slice(0, i)] && boxes[core.slice(i + 1)]) { srcId = core.slice(0, i); dstId = core.slice(i + 1); break; }
        }
      }
      const e = { p, pts, invisible: /edge-thickness-invisible/.test(p.getAttribute('class') || ''), srcId, dstId, bbox: bboxOf(pts) };
      reg.list.push(e);
      reg.byEl.set(p, e);
    });
    routeCache.set(svg, reg);
    return reg;
  };
  // 候选与其他边的首个严格交叉段（无则 null）；同源同目标的平行边不参与（互相避让无意义）
  const mkEdgeHit = (svg, self) => (cand) => {
    if (!self) return null;
    const cb = bboxOf(cand);
    for (const e of routesOf(svg).list) {
      if (e === self || e.invisible) continue;
      if (self.srcId && e.srcId === self.srcId && e.dstId === self.dstId) continue;
      if (cb.x2 < e.bbox.x1 || cb.x1 > e.bbox.x2 || cb.y2 < e.bbox.y1 || cb.y1 > e.bbox.y2) continue;
      for (let i = 0; i < cand.length - 1; i++)
        for (let j = 0; j < e.pts.length - 1; j++)
          if (segX(cand[i], cand[i + 1], e.pts[j], e.pts[j + 1])) return [e.pts[j], e.pts[j + 1]];
    }
    return null;
  };
  // 选路优先级（字典序）：不穿盒 > 末段方向合规 > 不穿其他边 > 拟合分。候选不够时两轮扩容：
  // ① 基础候选穿到哪些盒，就把竖/横干线挪到盒缘外 8px 再试（N5-->N6 需在 N3 右缘外穿行）；
  // ② 仍穿边就把干线挪到被穿越段的端点外 8px 再试一轮。
  // 扩容后仍不干净、且 dagre 原始路由干净（不穿盒/不穿边/方向合规）→ 保留原始斜线不直角化
  // （D2-->END 一类：dagre 本已左绕 B2，两点直线早退曾把它拉成竖穿 B2 盒）。
  const ortho = (pts, endDir, ctx) => {
    const S = pts[0], E = pts[pts.length - 1];
    const xBoxes = ctx ? crossBoxesOf(ctx.boxes, ctx.srcId, ctx.dstId) : () => [];
    const edgeHit = ctx ? ctx.edgeHit : null;
    const pen = ctx && ctx.pen ? ctx.pen : () => false;
    const straight = [S, E];
    if ((Math.abs(E[0] - S[0]) < 0.6 || Math.abs(E[1] - S[1]) < 0.6) && !xBoxes(straight).length && !pen(straight) && !(edgeHit && edgeHit(straight))) return straight;
    const mids = pts.slice(1, -1);
    const uniq = (arr) => [...new Set(arr)];
    const build = (mxs, mys) => [
      [S, [S[0], E[1]], E],
      [S, [E[0], S[1]], E],
      ...mxs.map((mx) => [S, [mx, S[1]], [mx, E[1]], E]),
      ...mys.map((my) => [S, [S[0], my], [E[0], my], E]),
    ];
    const mxs = uniq([round2((S[0] + E[0]) / 2), ...(mids.length ? [round2(median(mids.map((p) => p[0])))] : [])]);
    const mys = uniq([round2((S[1] + E[1]) / 2), ...(mids.length ? [round2(median(mids.map((p) => p[1])))] : [])]);
    let cands = build(mxs, mys);
    // 扩容①：盒缘外 8px 干线。穿到目标盒自身（pen）时同样扩——把目标盒缘外 8px 加入干线，
    // 让汇合边能走盒外 L 形（W2-->END 竖干线穿「结束」盒 → 改走左缘外 x=tBox.x-8 横进）
    const hitBoxes = uniq(cands.flatMap((c) => xBoxes(c)));
    const penHit = cands.some((c) => pen(c));
    if (ctx && (hitBoxes.length || penHit)) {
      const ex = [], ey = [];
      for (const id of hitBoxes.slice(0, 6)) {
        const b = ctx.boxes[id];
        ex.push(round2(b.x - 8), round2(b.x + b.w + 8));
        ey.push(round2(b.y - 8), round2(b.y + b.h + 8));
      }
      if (penHit && ctx.dstBox) {
        const b = ctx.dstBox;
        ex.push(round2(b.x - 8), round2(b.x + b.w + 8));
        ey.push(round2(b.y - 8), round2(b.y + b.h + 8));
      }
      cands = cands.concat(build(uniq(ex).slice(0, 12), uniq(ey).slice(0, 12)));
    }
    let best = null, bk = null;
    const consider = (list) => {
      for (const c of list) {
        // 字典序：不穿盒（含不穿目标盒内部）> 不穿其他边 > 方向合规 > 拟合分。方向让位给
        // 穿边——端点贴形阶段常能把方向问题修回来（箭尖贴边/卡跨距），穿边却修不了（svg#46）
        const k = [(xBoxes(c).length || pen(c)) ? 1 : 0, edgeHit && edgeHit(c) ? 1 : 0, endDir && dirOf(c) !== endDir ? 1 : 0, fitScore(c, pts)];
        if (!bk || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && (k[2] < bk[2] || (k[2] === bk[2] && k[3] < bk[3] - 1e-6)))))) { bk = k; best = c; }
      }
    };
    consider(cands);
    // 扩容②：仍穿边，干线挪到被穿越段的端点外 8px 再试一轮
    if (bk && bk[1] > 0 && edgeHit) {
      const hit = edgeHit(best);
      if (hit) {
        const [ha, hb2] = hit;
        consider(build(uniq([round2(ha[0] - 8), round2(ha[0] + 8), round2(hb2[0] - 8), round2(hb2[0] + 8)]), uniq([round2(ha[1] - 8), round2(ha[1] + 8), round2(hb2[1] - 8), round2(hb2[1] + 8)])));
      }
    }
    // 仍不干净：dagre 原始路由干净（不穿盒/不穿目标盒内部/不穿边、方向合规）则保留原始斜线
    if (bk && (bk[0] > 0 || bk[1] > 0)) {
      const origBad = xBoxes(pts).length > 0 || pen(pts) || (endDir && dirOf(pts) !== endDir) || (edgeHit && edgeHit(pts));
      if (!origBad) return pts.slice();
    }
    return best;
  };
  // 边标签随路由重挂用的折线工具：弧长、按弧长取点、点投影（返回最近点及其弧长位置）
  const polyLen = (pts) => {
    let L = 0;
    for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    return L;
  };
  const pointAt = (pts, at) => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + L >= at) {
        const t = L ? (at - acc) / L : 0;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      acc += L;
    }
    return pts[pts.length - 1];
  };
  const projectOn = (p, pts) => {
    let bd = Infinity, bl = 0, bp = pts[0], acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const wx = p[0] - a[0], wy = p[1] - a[1];
      const l2 = vx * vx + vy * vy;
      let t = l2 ? (wx * vx + wy * vy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const q = [a[0] + t * vx, a[1] + t * vy];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; bl = acc + Math.sqrt(l2) * t; bp = q; }
      acc += Math.sqrt(l2);
    }
    return { d: bd, len: bl, pt: bp };
  };
  // 各 svg 的边标签缓存（mermaid 把标签放在路径中点，g.edgeLabel 的 translate 即标签中心）
  const labelCache = new Map();
  const labelsOf = (svg) => {
    if (labelCache.has(svg)) return labelCache.get(svg);
    const list = [];
    svg.querySelectorAll('g.edgeLabel').forEach((g) => {
      const t = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      if (t) list.push({ g, x: +t[1], y: +t[2], used: false });
    });
    labelCache.set(svg, list);
    return list;
  };
  // 自旋回环整形（在主循环之前）：J 是隐形汇合节点（id 以 _J 结尾、标签空白，结构
  // PRE-->J / J-->W / W---J，W 为菱形）。dagre 把 J 当普通节点，为避免对向两边重叠会把
  // J-->W 绕到菱形左上斜边进、回边贴在右上斜边——与参考画法（用户供图定稿）不符：
  // J 钉在 W 竖直中轴上、J-->W 竖直 ▼ 进顶角、否回边从右角出 右-上-左 进 J 右侧（T 形并入）。
  // 整形后主线竖直、回边横平竖直，主循环对直线早退/拟合分 0 均原样保留。
  document.querySelectorAll('svg').forEach((svg) => {
    const boxes = boxesOf(svg);
    svg.querySelectorAll('g.node[id^="flowchart-"]').forEach((g) => {
      const m = g.getAttribute('id').match(/^flowchart-(.+)-\\d+$/);
      if (!m || !/_J$/.test(m[1]) || g.textContent.trim() !== '') return;
      const jId = m[1];
      // 收集与 J 相连的全部边，再按方向分出 入边/出边/回边（与 DOM 顺序无关）
      const touching = [];
      svg.querySelectorAll('path.flowchart-link').forEach((p) => {
        const em = (p.getAttribute('id') || '').match(/^L_(.+)_\\d+$/);
        if (!em) return;
        const core = em[1];
        for (let i = 1; i < core.length - 1; i++) {
          if (core[i] !== '_') continue;
          const s = core.slice(0, i), t = core.slice(i + 1);
          if (!boxes[s] || !boxes[t]) continue;
          if (s === jId || t === jId) touching.push({ p, s, t });
          break;
        }
      });
      const outE = touching.find((e) => e.s === jId);
      if (!outE) return;
      const wId = outE.t;
      const backE = touching.find((e) => e.s === wId && e.t === jId);
      const inE = touching.find((e) => e.t === jId && e.s !== jId && e.s !== wId);
      const wG = svg.querySelector('g.node[id^="flowchart-' + wId + '-"]');
      if (!backE || !inE || !wG || !wG.querySelector('polygon')) return;  // W 非菱形不整
      const jBox = boxes[jId], wBox = boxes[wId];
      // J 钉到 W 中轴（水平居中，y 不动）；同步改 boxes 缓存让主循环看到新位置
      const jt = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      const wcx = wBox.x + wBox.w / 2;
      const dxc = wcx - (jBox.x + jBox.w / 2);
      if (jt) g.setAttribute('transform', 'translate(' + (+jt[1] + dxc) + ', ' + jt[2] + ')');
      // 汇合点圆点是节点 g 的同级元素（保 getBBox 为零），g 平移时圆点要同步
      const jDot = g.parentNode && g.parentNode.querySelector('circle.junction-dot[data-junction="' + jId + '"]');
      if (jDot) jDot.setAttribute('cx', String(+jDot.getAttribute('cx') + dxc));
      jBox.x += dxc;
      const jcx = jBox.x + jBox.w / 2, jcy = jBox.y + jBox.h / 2;
      // J-->W：竖直 ▼ 进顶角（直线，主循环早退原样保留；菱形不做端点贴形）
      outE.p.setAttribute('d', 'M' + jcx + ',' + (jBox.y + jBox.h) + 'L' + wcx + ',' + wBox.y);
      // 否回边：右角 → 右 → 上 → 左进 J 右侧；竖通道沿用 dagre 原路径的 max-x（已避开节点），
      // 主循环对这条 H-V-H 干线拟合分 0 原样保留，端点贴形在右侧边上移动量 0
      const bp = [...(backE.p.getAttribute('d') || '').matchAll(/([\\d.]+),([\\d.]+)/g)].map((q) => [+q[1], +q[2]]);
      const rvx = wBox.x + wBox.w, rvy = wBox.y + wBox.h / 2;
      const gapX = Math.max(rvx + 48, ...bp.map((q) => q[0]));
      backE.p.setAttribute('d', 'M' + rvx + ',' + rvy + 'L' + gapX + ',' + rvy + 'L' + gapX + ',' + jcy + 'L' + (jBox.x + jBox.w) + ',' + jcy);
      // 回边右通道可能超出 mermaid 原始 viewBox——SVG 不渲染 viewBox 外内容（回路右竖线被截），按需右扩
      const vb = svg.viewBox && svg.viewBox.baseVal;
      if (vb && gapX + 8 > vb.x + vb.width) {
        vb.width = gapX + 8 - vb.x;
        const wa = svg.getAttribute('width');
        if (wa && wa.indexOf('%') < 0) svg.setAttribute('width', String(vb.width));
        if (svg.style && /px$/.test(svg.style.maxWidth)) svg.style.maxWidth = vb.width + 'px';
      }
      // 入边端点改 J 顶边中点：主循环按新端点重拟合，端点法线约束竖直进顶
      const ip = [...(inE.p.getAttribute('d') || '').matchAll(/([\\d.]+),([\\d.]+)/g)].map((q) => [+q[1], +q[2]]);
      if (ip.length >= 2) {
        ip[ip.length - 1] = [jcx, jBox.y];
        inE.p.setAttribute('d', 'M' + ip.map((q) => q[0] + ',' + q[1]).join('L'));
      }
    });
  });
  // 单条边选路（不改 DOM，返回定稿折线）：两遍主循环共用——第一遍按 DOM 序定稿（后续边
  // 避让已定稿的），第二遍从 dagre 原始路径对所有边重选——消除处理顺序死锁（A 避让 B 的
  // dagre 原始斜线而选了交叉路由，B 随后改道，A 本有干净路由却无从得知：svg#51 D1-->R1
  // 的最优 my930.66 第一遍被 D0-->END 的原始干线否决，第二遍才轮到它）。
  const routeEdge = (p, pts) => {
    const svg = p.closest('svg');
    // 边 id L_<源>_<目标>_<n>：按下划线拆出源/目标节点（节点 id 本身含下划线，逐位试拆），取端点所在边的法线约束
    let endDir = null, endPts = pts, sp0 = null, ctx = null, xBoxes = null, xEdge = null;
    let srcId = null, dstId = null, tBox = null, dstG = null, ds = null;
    const selfE = routesOf(svg).byEl.get(p) || null;
    const em = (p.getAttribute('id') || '').match(/^L_(.+)_\\d+$/);
    if (em) {
      const boxes = boxesOf(svg);
      const core = em[1];
      for (let i = 1; i < core.length - 1; i++) {
        if (core[i] !== '_') continue;
        if (!boxes[core.slice(0, i)] || !boxes[core.slice(i + 1)]) continue;
        srcId = core.slice(0, i);
        dstId = core.slice(i + 1);
        break;
      }
      if (dstId) {
        xBoxes = crossBoxesOf(boxes, srcId, dstId);
        xEdge = mkEdgeHit(svg, selfE);
        tBox = boxes[dstId];
        dstG = svg.querySelector('g.node[id^="flowchart-' + dstId + '-"]');
        // 矩形族目标才做穿透检查（polygon 目标斜边端点本在包围盒内，恒误判）
        const rectFamDst = dstG && !dstG.querySelector('polygon');
        ctx = { boxes, srcId, dstId, edgeHit: xEdge, pen: rectFamDst ? penInto(tBox) : null, dstBox: tBox };
        // 隐形汇合点目标（包围盒已坍缩为零尺寸）：入边端点改为中心点，多方向入边汇聚
        // 到同一点。零尺寸盒使四边等距、下方 endDir 两分支自然不命中（无方向约束），
        // 端点贴形对端点即中心的边是恒等操作（x/y 都被钳到中心），均无需特判。
        if (tBox.w === 0 && tBox.h === 0) endPts = [...pts.slice(0, -1), [round2(tBox.x), round2(tBox.y)]];
        const S0 = pts[0], E0 = pts[pts.length - 1];
        ds = [
          ['T', distToSeg(E0, [tBox.x, tBox.y], [tBox.x + tBox.w, tBox.y])],
          ['B', distToSeg(E0, [tBox.x, tBox.y + tBox.h], [tBox.x + tBox.w, tBox.y + tBox.h])],
          ['L', distToSeg(E0, [tBox.x, tBox.y], [tBox.x, tBox.y + tBox.h])],
          ['R', distToSeg(E0, [tBox.x + tBox.w, tBox.y], [tBox.x + tBox.w, tBox.y + tBox.h])],
        ].sort((a, b) => a[1] - b[1]);
        const axis = (s) => (s === 'T' || s === 'B' ? 'V' : 'H');
        if (ds[0][1] <= 12 && ds[1][1] - ds[0][1] > 8) {
          // 明确贴某条边：末段沿该边法线（顶/底竖直进▼、左右水平进）
          endDir = axis(ds[0][0]);
        } else if (ds[0][1] <= 12 && axis(ds[0][0]) !== axis(ds[1][0])) {
          // 角部模糊（一顶/底边 + 一侧边距离相近）：不能放任——dagre 的横进顶边会原样
          // 保留成躺平箭头（D2--否-->I 端点在 I 顶边距左角 4px，用户反馈"箭头躺着"）。
          // 矩形族节点 + 来源在角侧盒外 + 该侧边无其他入边 → 端点平移到侧缘横进
          // （W2-->END 类汇合，与对侧兄弟边同高对称，用户明确要这种）；
          // 但仅当平移后存在不穿盒的横进候选才采用——D1--否-->END 直下必穿「读 InitCheckRslt」
          // 盒、按 dagre 干线左绕则不穿 → 采用平移；没有干净横进路由就退回竖进顶/底边
          // （侧边已被兄弟入边占用（I 左边已有 P-->I）或来源在盒内时也竖直进）。
          const sideCh = axis(ds[0][0]) === 'H' ? ds[0][0] : ds[1][0];
          const sgn = sideCh === 'L' ? -1 : 1;
          const outSide = sgn < 0 ? S0[0] < tBox.x - 4 : S0[0] > tBox.x + tBox.w + 4;
          // 仅矩形族节点（无 polygon 子元素）可平移；菱形/平行四边形包围盒边不贴实际形状
          const rectFam = dstG && !dstG.querySelector('polygon');
          const occ = occOf(svg)[dstId] || [];
          const edgeId = p.getAttribute('id') || '';
          const sideFree = !occ.some((o) => o.side === sideCh && o.id !== edgeId);
          if (rectFam && outSide && sideFree) {
            const nx = sgn > 0 ? tBox.x + tBox.w : tBox.x;
            const shifted = [...pts.slice(0, -1), [nx, E0[1]]];
            const trySp = ortho(shifted, 'H', ctx);
            if (trySp && dirOf(trySp) === 'H' && !xBoxes(trySp).length && !xEdge(trySp)) {
              endPts = shifted;  // 平移到侧缘（y 不变，与兄弟边同高）
              endDir = 'H';
              sp0 = trySp;
            } else endDir = 'V';
          } else endDir = 'V';
        }
      }
    }
    // 源是隐形汇合点（零尺寸包围盒）：出边起点同样改为中心点，与入边汇于同一点
    if (srcId) {
      const sb = boxesOf(svg)[srcId];
      if (sb && sb.w === 0 && sb.h === 0) endPts = [[round2(sb.x), round2(sb.y)], ...endPts.slice(1)];
    }
    let sp = sp0 || ortho(endPts, endDir, ctx);
    // 躺平进顶/底边救援：端点贴目标顶/底边（≤2.5px）、方向合规要求竖进，但所有竖进候选
    // 都被穿盒/穿边否决时，正交化只能选出末段水平的躺平箭头（IoMcuAdc GetAdcRaw
    // D3--否-->W2：C2 盒封死 x≤652 走廊、兄弟边 D4→W3 的横干线封死 x>601 走廊，竖进
    // 数学上无解）。此时把端点平移到朝来路一侧的侧边中点横进（▶ 侧缘进，同侧向汇合
    // 画法）；polygon 目标（平行四边形）按斜边实际位置求该 y 的边 x——直接钉 bbox
    // 侧边会悬空（W2 bbox 左边 527 vs 斜边实际 538）。无干净横进路由则保留躺平原样。
    if (sp && !sp0 && tBox && ds && endDir === 'V' && dirOf(sp) === 'H' &&
        (ds[0][0] === 'T' || ds[0][0] === 'B') && ds[0][1] <= 2.5 && sp.length >= 2) {
      const trunkX = sp[sp.length - 2][0];
      const sideCh = trunkX < tBox.x ? 'L' : trunkX > tBox.x + tBox.w ? 'R' : null;
      if (sideCh) {
        const yMid = round2(tBox.y + tBox.h / 2);
        let sideX = sideCh === 'L' ? tBox.x : tBox.x + tBox.w;
        const poly = dstG ? dstG.querySelector('polygon') : null;
        if (poly) {
          const gm = (dstG.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
          const tm = (poly.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
          const ox = (gm ? +gm[1] : 0) + (tm ? +tm[1] : 0), oy = (gm ? +gm[2] : 0) + (tm ? +tm[2] : 0);
          const vp = (poly.getAttribute('points') || '').trim().split(/\\s+/).map((q) => { const w = q.split(','); return [+w[0] + ox, +w[1] + oy]; });
          const xs = [];
          for (let i = 0; i < vp.length; i++) {
            const a = vp[i], b = vp[(i + 1) % vp.length];
            if (Math.abs(a[1] - b[1]) < 1e-6 || (a[1] - yMid) * (b[1] - yMid) > 0) continue;
            xs.push(a[0] + (yMid - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
          if (xs.length >= 2) sideX = round2(sideCh === 'L' ? Math.min.apply(null, xs) : Math.max.apply(null, xs));
        }
        const shifted = [...endPts.slice(0, -1), [sideX, yMid]];
        const trySp = ortho(shifted, 'H', ctx);
        if (trySp && dirOf(trySp) === 'H' && !xBoxes(trySp).length && !(ctx.pen && ctx.pen(trySp)) && !xEdge(trySp)) {
          endPts = shifted;
          endDir = 'H';
          sp = trySp;
        }
      }
    }
    // 端点贴形：贴边（≤12px）端点把箭头尖贴到盒边——dagre 按原始斜向求的交点在直角化后会
    // 悬空（D1-->END 尖浮在「结束」胶囊左肩外 6px，用户反馈"箭头和框离得远"）；进点坐标
    // 卡进盒跨距（胶囊 rx>0 留平直段；普通矩形也要卡——svg#0 横进箭尖曾悬在盒底边下 2px）。
    // 两点直线被夹出拐点时插入拐点；贴形改线后穿盒/穿边或移动过大则放弃。
    if (tBox && ds && ds[0][1] <= 12 && dstG && !dstG.querySelector('polygon') && sp.length >= 2) {
      const rect = dstG.querySelector('rect[rx]');
      const rx = rect ? +(rect.getAttribute('rx') || 0) : 0;
      const pad = rx > 0 ? rx : 0;
      const li = sp.length - 1;
      const A = sp[li - 1], E = sp[li];
      let snapped = sp.map((q) => [q[0], q[1]]);
      if (dirOf(sp) === 'V') {
        const ySnap = Math.abs(E[1] - tBox.y) <= Math.abs(E[1] - (tBox.y + tBox.h)) ? tBox.y : tBox.y + tBox.h;
        const x = Math.min(Math.max(E[0], tBox.x + pad), tBox.x + tBox.w - pad);
        if (x === A[0]) snapped[li] = [x, ySnap];
        else if (sp.length >= 3 && Math.abs(sp[li - 2][1] - A[1]) < 0.6) { snapped[li - 1] = [x, A[1]]; snapped[li] = [x, ySnap]; }
        else snapped = [...sp.slice(0, -1), [x, A[1]], [x, ySnap]];
      } else {
        const xSnap = Math.abs(E[0] - tBox.x) <= Math.abs(E[0] - (tBox.x + tBox.w)) ? tBox.x : tBox.x + tBox.w;
        const y = Math.min(Math.max(E[1], tBox.y + pad), tBox.y + tBox.h - pad);
        if (y === A[1]) snapped[li] = [xSnap, y];
        else if (sp.length >= 3 && Math.abs(sp[li - 2][0] - A[0]) < 0.6) { snapped[li - 1] = [A[0], y]; snapped[li] = [xSnap, y]; }
        else snapped = [...sp.slice(0, -1), [A[0], y], [xSnap, y]];
      }
      const tip = snapped[snapped.length - 1];
      const moved = Math.abs(tip[0] - E[0]) + Math.abs(tip[1] - E[1]);
      const pen = ctx && ctx.pen ? ctx.pen : () => false;
      if (moved <= 30 && !pen(snapped) && (!xBoxes || !xBoxes(snapped).length) && !(xEdge && xEdge(snapped))) sp = snapped;
    }
    // ⑥ 贴缘/近距修饰（美观，最后做，改后穿盒/穿边/穿目标盒/方向改变均放弃）：
    // a) 横段与其他节点顶/底边共线贴合（<2.5px 且横向重叠）时抬/降到盒外 8px——
    //    SinSafetyBistCheck 图 P2-->D0 回边横段与 E2 顶边完全贴合，像从盒上碾过；
    //    首/末段为保端点贴在盒边上用插拐平移（末段插拐不得改变入箭方向）。
    //    ±8 常被兄弟边下垂段否决（T21-->END 抬升撞上 T31-->END 的下垂线）——按否决段
    //    端点 y 再向外推 8px 爬梯（最多 3 级、总位移 ≤64px），直到干净或放弃。
    // b) 竖段与其他边竖段平行间距 <12px 且纵向重叠时错开到 16px——否边下落（x=731.77）
    //    与回边上行（x=739.77）隔 8px，两条线易看成一条。
    if (ctx && sp.length >= 2) {
      const pen = ctx.pen ? ctx.pen : () => false;
      const clean = (cand) => !(xBoxes && xBoxes(cand).length) && !pen(cand) && !(xEdge && xEdge(cand));
      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i], b = sp[i + 1];
        if (Math.abs(a[1] - b[1]) >= 0.6) continue;
        const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
        let yTry = null, up = true, hugId = null;
        for (const id in ctx.boxes) {
          if (id === ctx.srcId || id === ctx.dstId) continue;
          const bx = ctx.boxes[id];
          if (bx.w === 0 && bx.h === 0) continue;  // 零尺寸=隐形汇合点，无盒缘可贴
          if (x2 < bx.x + 1 || x1 > bx.x + bx.w - 1) continue;
          if (Math.abs(a[1] - bx.y) < 2.5) { yTry = round2(bx.y - 8); up = true; hugId = id; break; }
          if (Math.abs(a[1] - (bx.y + bx.h)) < 2.5) { yTry = round2(bx.y + bx.h + 8); up = false; hugId = id; break; }
        }
        if (yTry === null) continue;
        let applied = false;
        for (let att = 0; att < 3 && Math.abs(yTry - a[1]) <= 64; att++) {
          let cand = null;
          if (i > 0 && i < sp.length - 2) { cand = sp.map((q) => [q[0], q[1]]); cand[i][1] = cand[i + 1][1] = yTry; }
          else if (i === 0 && sp.length >= 3 && Math.abs(sp[1][0] - sp[2][0]) < 0.6)
            cand = [sp[0], [sp[0][0], yTry], [sp[1][0], yTry], ...sp.slice(2)];
          else if (i === sp.length - 2 && sp.length >= 3 && Math.abs(sp[i - 1][0] - sp[i][0]) < 0.6)
            cand = [...sp.slice(0, i + 1), [sp[i][0], yTry], [sp[i + 1][0], yTry], sp[i + 1]];
          if (!cand || dirOf(cand) !== dirOf(sp) || (xBoxes && xBoxes(cand).length) || pen(cand)) break;
          const hit = xEdge && xEdge(cand);
          if (!hit) { sp = cand; applied = true; break; }
          // 爬梯：越过挡住它的段（其远侧端点再向外 8px）
          yTry = round2(up ? Math.min(hit[0][1], hit[1][1]) - 8 : Math.max(hit[0][1], hit[1][1]) + 8);
        }
        // 退路B：竖移被邻边走廊封死（或末段竖移会改变入箭方向）时，改把相邻竖段
        // 平移到贴缘盒的侧向空隙（盒缘外 8px），横段随之缩短到不再覆盖该盒——
        // svg#0 文件包含图 c-->Callout_h 末段贴 Cfg_c 底边，竖移会把入箭方向
        // 从 H 改成 V；把末段前的竖段左移到 Cfg_c 与 Callout_h 之间后贴缘消失。
        // （首段情形如 P2-->D0 贴 E2 顶：竖段左移会横穿邻边横臂被 xEdge 否决，
        //   属布局锁死，保持贴缘。）
        if (!applied && hugId && (i === 0 || i === sp.length - 2)) {
          const vb = ctx.boxes[hugId];
          for (const side of [0, 1]) {
            const newX = round2(side === 0 ? vb.x - 8 : vb.x + vb.w + 8);
            let cand = null, hSeg = null;
            if (i === 0 && sp.length >= 3 && Math.abs(sp[1][0] - sp[2][0]) < 0.6) {
              if ((newX - sp[0][0]) * (sp[1][0] - sp[0][0]) <= 0 || Math.abs(newX - sp[0][0]) <= 8) continue; // 不反向/不塌缩
              cand = [sp[0], [newX, sp[0][1]], [newX, sp[2][1]], ...sp.slice(3)];
              hSeg = [cand[0], cand[1]];
            } else if (i === sp.length - 2 && sp.length >= 3 && Math.abs(sp[i - 1][0] - sp[i][0]) < 0.6) {
              if ((sp[i + 1][0] - newX) * (sp[i + 1][0] - sp[i][0]) <= 0 || Math.abs(sp[i + 1][0] - newX) <= 8) continue;
              cand = [...sp.slice(0, i), [newX, sp[i - 1][1]], [newX, sp[i][1]], sp[i + 1]];
              hSeg = [cand[cand.length - 2], cand[cand.length - 1]];
            }
            if (!cand || dirOf(cand) !== dirOf(sp) || !clean(cand)) continue;
            // 新横段不得再贴任何盒缘（否则只是换了个盒子贴）
            const hx1 = Math.min(hSeg[0][0], hSeg[1][0]), hx2 = Math.max(hSeg[0][0], hSeg[1][0]);
            let rehug = false;
            for (const id2 in ctx.boxes) {
              if (id2 === ctx.srcId || id2 === ctx.dstId) continue;
              const b2 = ctx.boxes[id2];
              if (b2.w === 0 && b2.h === 0) continue;  // 汇合点不算盒缘
              if (hx2 < b2.x + 1 || hx1 > b2.x + b2.w - 1) continue;
              if (Math.abs(hSeg[0][1] - b2.y) < 2.5 || Math.abs(hSeg[0][1] - (b2.y + b2.h)) < 2.5) { rehug = true; break; }
            }
            if (rehug) continue;
            sp = cand; applied = true; break;
          }
        }
        if (applied) break;
      }
      // 竖段近距错开
      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i], b = sp[i + 1];
        if (Math.abs(a[0] - b[0]) >= 0.6) continue;
        const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
        let nearX = null;
        for (const e of routesOf(svg).list) {
          if (e === selfE || e.invisible) continue;
          for (let j = 0; j < e.pts.length - 1; j++) {
            const q1 = e.pts[j], q2 = e.pts[j + 1];
            if (Math.abs(q1[0] - q2[0]) >= 0.6) continue;
            const dx = a[0] - q1[0];
            if (Math.abs(dx) >= 12 || dx === 0) continue;
            const oy = Math.min(y2, Math.max(q1[1], q2[1])) - Math.max(y1, Math.min(q1[1], q2[1]));
            if (oy > 4) { nearX = round2(q1[0] + (dx > 0 ? 16 : -16)); break; }
          }
          if (nearX !== null) break;
        }
        if (nearX === null) continue;
        // 仅动内部竖段：首/末段插拐会让横Stub滑在自己盒缘上（新的自贴缘），不值得
        let cand = null;
        if (i > 0 && i < sp.length - 2) { cand = sp.map((q) => [q[0], q[1]]); cand[i][0] = cand[i + 1][0] = nearX; }
        if (cand && dirOf(cand) === dirOf(sp) && clean(cand)) { sp = cand; break; }
      }
    }
    return sp;
  };
  // 两遍选路 + 统一落笔：entry.orig 存 dagre 原始路径（登记表按当前 d 惰性建立，此时即
  // 原始/自旋整形后的路径）；每遍定稿后回写登记表的当前路由供后续边避让；最后统一写 d
  // 并重挂标签（标签按 orig → 定稿的弧长占比平移，只挂一次）。
  const edgeEls = [...document.querySelectorAll('svg path.flowchart-link')];
  const parsePts = (d) => {
    const pts = [];
    (d.match(/[A-Za-z][^A-Za-z]*/g) || []).forEach((seg) => {
      const nums = seg.slice(1).trim().split(/[ ,]+/).filter(Boolean).map(Number);
      if (nums.length >= 2) pts.push([nums[nums.length - 2], nums[nums.length - 1]]);
    });
    return pts;
  };
  for (let pass = 0; pass < 2; pass++) {
    edgeEls.forEach((p) => {
      const svg = p.closest('svg');
      const e = routesOf(svg).byEl.get(p);
      const orig = pass === 0 ? parsePts(p.getAttribute('d') || '') : (e && e.orig);
      if (!orig || orig.length < 2) return;
      if (e && pass === 0) e.orig = orig;
      const sp = routeEdge(p, orig);
      if (e) { e.pts = sp.map((q) => [q[0], q[1]]); e.bbox = bboxOf(e.pts); }
    });
  }
  edgeEls.forEach((p) => {
    const svg = p.closest('svg');
    const e = routesOf(svg).byEl.get(p);
    if (!e || !e.orig || !e.pts) return;
    const pts = e.orig, sp = e.pts;
    p.setAttribute('d', 'M' + sp.map((q) => q[0] + ',' + q[1]).join('L'));
    // 边标签随路由重挂：标签投影到原路径取弧长占比，平移到新路径同占比处——否则路由大改后
    // 标签留在旧干线旁（D1--否-->END 的「否」字离新线 87px，用户反馈"文字与线离得远"）。
    // 标签匹配：取投影到原路径距离最近（<30px）的未占用标签——mermaid 本就把它放在路径中点上。
    const labels = labelsOf(svg);
    let lab = null, ld = 30;
    for (const l of labels) {
      if (l.used) continue;
      const dd = projectOn([l.x, l.y], pts).d;
      if (dd < ld) { ld = dd; lab = l; }
    }
    if (lab) {
      lab.used = true;
      const oldL = polyLen(pts), newL = polyLen(sp);
      if (oldL > 0 && newL > 0) {
        const pr = projectOn([lab.x, lab.y], pts);
        const np = pointAt(sp, (pr.len / oldL) * newL);
        lab.g.setAttribute('transform', 'translate(' + (lab.x + np[0] - pr.pt[0]) + ', ' + (lab.y + np[1] - pr.pt[1]) + ')');
      }
    }
  });
});
</script>`;
}
