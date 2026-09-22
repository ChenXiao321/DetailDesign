/**
 * audit 子命令：渲染质量量化验收（内网闭环的验收环节）。
 * 一条命令完成：lld_design.json → 生成报告源版 → Edge 无头预渲染（SVG 成品）→
 * 斜线计数 + 交叉/穿盒审计 + 箭头朝向审计 → 中文量化验收报告。
 * 移植自本地脚本 _render_qwen.js / _xcheck.js / _arrowcheck.js（判定逻辑零改动），
 * 产物与 report 命令一致（lld_report.html 为预渲染成品版，lld_report_src.html 为源版备份）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateHtmlReport, type ModuleModel } from '@lld/core';
import { findEdge } from './edge.js';
import { loadConfigFile, resolveAbbreviations, abbrGapLogger } from './config.js';

/** file:// URL 编码（中文路径必须逐段 encodeURIComponent，照抄 _render.js） */
function toFileUrl(p: string): string {
  return 'file:///' + p.replace(/\\/g, '/').replace(/#/g, '%23')
    .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
}

function edgeDump(edge: string, htmlPath: string): string {
  // stderr 不继承（Edge 无头模式噪音多：libpng/同步组件报错等），失败时取尾部打印
  try {
    return execFileSync(edge, ['--headless', '--disable-gpu', '--dump-dom',
      '--virtual-time-budget=20000', toFileUrl(htmlPath)],
      { maxBuffer: 64 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf-8');
  } catch (err) {
    const e = err as { message: string; stderr?: Buffer };
    const tail = e.stderr ? e.stderr.toString('utf-8').slice(-300) : '';
    throw new Error(`无头浏览器渲染失败（${e.message}）${tail ? ': ' + tail : ''}\n  排查：Edge/Chrome 是否可正常运行；路径含特殊字符时可把产物目录换到纯英文路径再试`);
  }
}

/** 斜线计数：flowchart 边路径逐段判斜（|dx|>0.6 且 |dy|>0.6），含曲线命令即非直角 */
function countDiagonalEdges(html: string): { ortho: number; diag: number; diagIds: string[] } {
  // 坑：flowchart 边属性顺序 d 在前 class 在后两种都要匹配，否则只数到序列图边
  const tags = [...html.matchAll(/<path\b[^>]*>/g)].map(m => m[0])
    .filter(t => /class="[^"]*flowchart-link[^"]*"/.test(t));
  let ortho = 0, diag = 0;
  const diagIds: string[] = [];
  for (const tag of tags) {
    const dm = tag.match(/d="([^"]+)"/);
    if (!dm) continue;
    const d = dm[1]!;
    const segs = [...d.matchAll(/L(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m => [+m[1]!, +m[2]!] as [number, number]);
    const m0 = d.match(/M(-?[\d.]+)[ ,](-?[\d.]+)/);
    let isOrtho = !d.includes('C');
    if (m0 && isOrtho) {
      let p: [number, number] = [+m0[1]!, +m0[2]!];
      for (const q of segs) {
        if (Math.abs(q[0] - p[0]) > 0.6 && Math.abs(q[1] - p[1]) > 0.6) { isOrtho = false; break; }
        p = q;
      }
    }
    if (isOrtho) ortho++;
    else { diag++; const im = tag.match(/id="(L_[^"]+)"/); diagIds.push(im ? im[1]! : '(无id)'); }
  }
  return { ortho, diag, diagIds };
}

/** 交叉/穿盒/越界/深入目标盒/贴缘审计（_xcheck.js 移植，纯 Node 字符串解析） */
function xcheck(html: string): string[] {
  const lines: string[] = [];
  const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
  svgs.forEach((svg, si) => {
    const edges: { id: string; pts: [number, number][]; invisible: boolean; ptsCurved: boolean }[] = [];
    // 注意：不要用 /<path [^>]*\sd=.../ 单正则——Node 25.2.1 的 V8 Irregexp 对
    // 「字面空格+[^>]*+字面」模式有预检索 bug，会静默解析出 0 条边造成审计假绿。两步解析。
    for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
      const tag = m[0];
      const dm = tag.match(/d="([^"]+)"/);
      const im = tag.match(/id="(L_[^"]+)"/);
      if (!dm || !im) continue;
      const pts = [...dm[1]!.matchAll(/([\d.]+),([\d.]+)/g)].map(p => [+p[1]!, +p[2]!] as [number, number]);
      edges.push({ id: im[1]!, pts, invisible: /edge-thickness-invisible/.test(tag), ptsCurved: dm[1]!.includes('C') });
    }
    const boxes: Record<string, { x: number; y: number; w: number; h: number; poly: boolean }> = {};
    const gRe = /<g class="node[^"]*" id="flowchart-([A-Za-z0-9_]+)-\d+" transform="translate\((-?[\d.]+), (-?[\d.]+)\)"([\s\S]*?)(?=<g class="node|<g class="edgeLabel|<\/svg>)/g;
    let gm;
    while ((gm = gRe.exec(svg))) {
      const id = gm[1]!, tx = +gm[2]!, ty = +gm[3]!, body = gm[4]!;
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      const rm = body.match(/<rect[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
      const pm = body.match(/<polygon points="([^"]+)"[^>]*transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
      if (rm) { x1 = +rm[1]!; y1 = +rm[2]!; x2 = x1 + +rm[3]!; y2 = y1 + +rm[4]!; }
      else if (pm) {
        const pp = [...pm[1]!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(q => [+q[1]! + +pm[2]!, +q[2]! + +pm[3]!]);
        x1 = Math.min(...pp.map(p => p[0])); x2 = Math.max(...pp.map(p => p[0]));
        y1 = Math.min(...pp.map(p => p[1])); y2 = Math.max(...pp.map(p => p[1]));
      } else continue;
      boxes[id] = { x: x1 + tx, y: y1 + ty, w: x2 - x1, h: y2 - y1, poly: !rm && !!pm };
    }
    const endsOf = (edgeId: string): [string, string] | null => {
      const em = edgeId.match(/^L_(.+)_\d+$/);
      if (!em) return null;
      const core = em[1]!;
      for (let i = 1; i < core.length - 1; i++) {
        if (core[i] !== '_') continue;
        if (boxes[core.slice(0, i)] && boxes[core.slice(i + 1)]) return [core.slice(0, i), core.slice(i + 1)];
      }
      return null;
    };
    // ① 边-边严格交叉
    const hits: string[] = [];
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i]!, b = edges[j]!;
      if (a.invisible || b.invisible) continue;
      for (let k = 0; k < a.pts.length - 1; k++) for (let l = 0; l < b.pts.length - 1; l++) {
        const [p1, p2] = [a.pts[k]!, a.pts[k + 1]!], [q1, q2] = [b.pts[l]!, b.pts[l + 1]!];
        const aVert = Math.abs(p1[0] - p2[0]) < 0.6, bVert = Math.abs(q1[0] - q2[0]) < 0.6;
        if (aVert === bVert) continue;
        const [v1, v2, h1] = aVert ? [p1, p2, q1] : [q1, q2, p1];
        const vx = v1![0], hy = h1![1];
        const inV = hy > Math.min(v1![1], v2![1]) + 0.6 && hy < Math.max(v1![1], v2![1]) - 0.6;
        const inH = vx > Math.min(h1![0], (aVert ? q2 : p2)![0]) + 0.6 && vx < Math.max(h1![0], (aVert ? q2 : p2)![0]) - 0.6;
        if (inV && inH) hits.push(`${a.id}#seg${k} X ${b.id}#seg${l} @(${vx.toFixed(1)},${hy.toFixed(1)})`);
      }
    }
    if (hits.length) { lines.push(`svg#${si} 边交叉:`); hits.forEach(h => lines.push('  ' + h)); }
    // ② 边穿节点盒（2px 缩边 AABB，源/目标自身除外）
    const bhits: string[] = [];
    for (const e of edges) {
      if (e.invisible) continue;
      const ends = endsOf(e.id);
      if (!ends) continue;
      for (let k = 0; k < e.pts.length - 1; k++) {
        const [a, b] = [e.pts[k]!, e.pts[k + 1]!];
        const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
        const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
        for (const id in boxes) {
          if (id === ends[0] || id === ends[1]) continue;
          const bx = boxes[id]!;
          if (x1 < bx.x + bx.w - 2 && x2 > bx.x + 2 && y1 < bx.y + bx.h - 2 && y2 > bx.y + 2)
            bhits.push(`${e.id}#seg${k} 穿 ${id} 盒`);
        }
      }
    }
    // ③ 边越出 viewBox
    const vbm = svg.match(/viewBox="(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
    if (vbm) {
      const [vx, vy, vw, vh] = [+vbm[1]!, +vbm[2]!, +vbm[3]!, +vbm[4]!];
      for (const e of edges) {
        if (e.invisible) continue;
        for (const [px, py] of e.pts) {
          if (px < vx - 0.5 || px > vx + vw + 0.5 || py < vy - 0.5 || py > vy + vh + 0.5) {
            bhits.push(`边越出 viewBox: ${e.id} @(${px.toFixed(1)},${py.toFixed(1)})`);
            break;
          }
        }
      }
    }
    // ④ 边深入矩形族目标盒内部（slab 法；polygon 目标恒误报跳过）
    for (const e of edges) {
      if (e.invisible) continue;
      const ends = endsOf(e.id);
      if (!ends) continue;
      const tb = boxes[ends[1]];
      if (!tb || tb.poly) continue;
      const x1 = tb.x + 2, x2 = tb.x + tb.w - 2, y1 = tb.y + 2, y2 = tb.y + tb.h - 2;
      for (let k = 0; k < e.pts.length - 1; k++) {
        const a = e.pts[k]!, b = e.pts[k + 1]!;
        const dx = b[0] - a[0], dy = b[1] - a[1];
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-9) { if (a[0] <= x1 || a[0] >= x2) continue; }
        else {
          let ta = (x1 - a[0]) / dx, t2 = (x2 - a[0]) / dx;
          if (ta > t2) { const t = ta; ta = t2; t2 = t; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, t2);
          if (t0 >= t1) continue;
        }
        if (Math.abs(dy) < 1e-9) { if (a[1] <= y1 || a[1] >= y2) continue; }
        else {
          let ta = (y1 - a[1]) / dy, t2 = (y2 - a[1]) / dy;
          if (ta > t2) { const t = ta; ta = t2; t2 = t; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, t2);
          if (t0 >= t1) continue;
        }
        bhits.push(`${e.id}#seg${k} 深入目标盒 ${ends[1]}`);
        break;
      }
    }
    // ⑤ 横段贴盒缘（美观项）
    for (const e of edges) {
      if (e.invisible) continue;
      const ends = endsOf(e.id);
      for (let k = 0; k < e.pts.length - 1; k++) {
        const a = e.pts[k]!, b = e.pts[k + 1]!;
        if (Math.abs(a[1] - b[1]) >= 0.6) continue;
        const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
        for (const id in boxes) {
          if (ends && (id === ends[0] || id === ends[1])) continue;
          const bx = boxes[id]!;
          for (const ey of [bx.y, bx.y + bx.h]) {
            if (Math.abs(a[1] - ey) < 1 && x2 > bx.x + 1 && x1 < bx.x + bx.w - 1) {
              bhits.push(`${e.id}#seg${k} 贴 ${id} ${ey === bx.y ? '顶' : '底'}边`);
              break;
            }
          }
        }
      }
    }
    // ⑥ 共线对向重叠（真交叉的漏网形态：两条边横段同 y 反向重叠 / 竖段同 x 反向重叠，
    //    严格交叉检查只查 H×V 相交，抓不到共线。典型成因：菱形两出边端口被 dagre 布反，
    //    左出口连右目标、右出口连左目标。同向重叠=汇合入同一节点，是正常形态不报）
    const ohits: string[] = [];
    const vis = edges.filter(e => !e.invisible && !e.ptsCurved);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i]!, b = vis[j]!;
      let reported = false;
      for (let k = 0; k + 1 < a.pts.length && !reported; k++) for (let l = 0; l + 1 < b.pts.length && !reported; l++) {
        const [p1, p2] = [a.pts[k]!, a.pts[k + 1]!], [q1, q2] = [b.pts[l]!, b.pts[l + 1]!];
        if (Math.abs(p1[1] - p2[1]) < 0.6 && Math.abs(q1[1] - q2[1]) < 0.6 && Math.abs(p1[1] - q1[1]) < 0.6) {
          const ov = Math.min(Math.max(p1[0], p2[0]), Math.max(q1[0], q2[0])) - Math.max(Math.min(p1[0], p2[0]), Math.min(q1[0], q2[0]));
          if (ov > 1 && Math.sign(p2[0] - p1[0]) !== Math.sign(q2[0] - q1[0])) {
            ohits.push(`${a.id} × ${b.id} 水平对向重叠 ${ov.toFixed(1)}px @y=${p1[1].toFixed(1)}`);
            reported = true;
          }
        }
        if (Math.abs(p1[0] - p2[0]) < 0.6 && Math.abs(q1[0] - q2[0]) < 0.6 && Math.abs(p1[0] - q1[0]) < 0.6) {
          const ov = Math.min(Math.max(p1[1], p2[1]), Math.max(q1[1], q2[1])) - Math.max(Math.min(p1[1], p2[1]), Math.min(q1[1], q2[1]));
          if (ov > 1 && Math.sign(p2[1] - p1[1]) !== Math.sign(q2[1] - q1[1])) {
            ohits.push(`${a.id} × ${b.id} 垂直对向重叠 ${ov.toFixed(1)}px @x=${p1[0].toFixed(1)}`);
            reported = true;
          }
        }
      }
    }
    if (ohits.length) { lines.push(`svg#${si} 共线对向重叠（疑似端口布反的真交叉）:`); ohits.forEach(h => lines.push('  ' + h)); }
    if (bhits.length) { lines.push(`svg#${si} 穿盒/越界/贴缘:`); bhits.forEach(h => lines.push('  ' + h)); }
  });
  return lines;
}

/** 箭头朝向审计（_arrowcheck.js 移植）：须 getBBox，注入渲染后 HTML 再跑一次 Edge */
const ARROW_AUDIT = `(function(){
  const out=[];
  document.querySelectorAll('svg').forEach((svg,si)=>{
    const map={};
    svg.querySelectorAll('g.node[id^="flowchart-"]').forEach((g)=>{
      const m=g.getAttribute('id').match(/^flowchart-(.+)-[0-9]+$/);
      const t=(g.getAttribute('transform')||'').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      if(!m||!t) return;
      const b=g.getBBox();
      map[m[1]]={x:b.x+ +t[1],y:b.y+ +t[2],w:b.width,h:b.height};
    });
    svg.querySelectorAll('path.flowchart-link').forEach((p)=>{
      if((p.getAttribute('class')||'').includes('edge-thickness-invisible')) return;
      const d=p.getAttribute('d'); if(!d) return;
      const pts=[...d.matchAll(/([\\d.]+),([\\d.]+)/g)].map(q=>[+q[1],+q[2]]);
      if(pts.length<2) return;
      const em=(p.getAttribute('id')||'').match(/^L_(.+)_[0-9]+$/); if(!em) return;
      const core=em[1];
      let dstId=null;
      for(let i=1;i<core.length-1;i++){
        if(core[i]!=='_') continue;
        if(map[core.slice(0,i)]&&map[core.slice(i+1)]){ dstId=core.slice(i+1); break; }
      }
      if(!dstId) return;
      const dstG=svg.querySelector('g.node[id^="flowchart-'+dstId+'-"]');
      if(!dstG) return;
      const t=map[dstId];
      const E=pts[pts.length-1], A=pts[pts.length-2];
      const dL=Math.abs(E[0]-t.x), dR=Math.abs(E[0]-(t.x+t.w));
      const dT=Math.abs(E[1]-t.y), dB=Math.abs(E[1]-(t.y+t.h));
      const dir=Math.abs(E[0]-A[0])>=Math.abs(E[1]-A[1])?'H':'V';
      const id=p.getAttribute('id');
      const poly=dstG.querySelector('polygon');
      if(poly){
        if(dir!=='H') return;
        const gm=(dstG.getAttribute('transform')||'').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
        const tm=(poly.getAttribute('transform')||'').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
        const ox=(gm?+gm[1]:0)+(tm?+tm[1]:0), oy=(gm?+gm[2]:0)+(tm?+tm[2]:0);
        const vp=(poly.getAttribute('points')||'').trim().split(/\\s+/).map((q)=>{const w=q.split(',');return [+w[0]+ox,+w[1]+oy];});
        ['T','B'].forEach((which)=>{
          const yy=which==='T'?t.y:t.y+t.h;
          const ep=vp.filter((q)=>Math.abs(q[1]-yy)<0.6);
          if(ep.length!==2) return;
          const x1=Math.min(ep[0][0],ep[1][0]), x2=Math.max(ep[0][0],ep[1][0]);
          if(Math.abs(E[1]-yy)<=2.5&&E[0]>=x1-2&&E[0]<=x2+2)
            out.push('svg#'+si+' '+id+' 横段躺平进'+(which==='T'?'顶':'底')+'边（polygon 目标）');
        });
        return;
      }
      if(Math.min(dL,dR,dT,dB)>12) return;
      if(dir==='V'){
        if(Math.min(dT,dB)>2.5) out.push('svg#'+si+' '+id+' 竖进但箭尖未贴顶/底边 dy='+Math.min(dT,dB).toFixed(1));
        else if(E[0]<t.x-2||E[0]>t.x+t.w+2) out.push('svg#'+si+' '+id+' 竖进但箭尖横向超出盒跨距');
      }else{
        if(Math.min(dL,dR)>2.5) out.push('svg#'+si+' '+id+' 横进但箭尖未贴左/右边 dx='+Math.min(dL,dR).toFixed(1));
        else if(E[1]<t.y-2||E[1]>t.y+t.h+2) out.push('svg#'+si+' '+id+' 横进但箭尖纵向超出盒跨距');
      }
    });
  });
  const div=document.createElement('div'); div.id='auditresult';
  div.textContent='AUDITRESULT:'+(out.length?out.join(' | '):'CLEAN');
  document.body.appendChild(div);
})();`;

function arrowCheck(edge: string, outDir: string, renderedHtml: string): string[] {
  const i = renderedHtml.lastIndexOf('</body>');
  const page = renderedHtml.slice(0, i) + '<scr' + 'ipt>' + ARROW_AUDIT + '</scr' + 'ipt>' + renderedHtml.slice(i);
  const tmp = path.join(outDir, '_audit_tmp.html');
  try {
    fs.writeFileSync(tmp, page, 'utf-8');
    const dump = edgeDump(edge, tmp);
    const m = dump.match(/id="auditresult">AUDITRESULT:([^<]*)/);
    if (!m) return ['(箭头审计未执行：dump 中无结果)'];
    return m[1] === 'CLEAN' ? [] : m[1]!.split(' | ');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

export async function cmdAudit(outDir: string): Promise<void> {
  const designPath = path.join(outDir, 'lld_design.json');
  const modelPath = path.join(outDir, 'lld_model.json');
  const sourcePath = fs.existsSync(designPath) ? designPath : modelPath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`未找到 ${designPath}，请先运行 analyze（和 gen）`);
    process.exit(1);
  }
  const edge = findEdge();
  const model = JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as ModuleModel;
  const mermaidPath = new URL('../assets/mermaid.min.js', import.meta.url);
  const mermaidJs = fs.readFileSync(mermaidPath, 'utf-8');

  // 1) 报告源版（与 report 命令同管线，图源 lint 警告会打到 stderr）
  const abbr = resolveAbbreviations(loadConfigFile());
  const html = generateHtmlReport(model, {
    mermaidJs,
    abbreviations: abbr?.entries,
    abbreviationsReplace: abbr?.replace,
    abbreviationSource: abbr?.source,
    definitions: abbr?.definitions,
    onAbbreviationGaps: abbrGapLogger,
  });
  const srcPath = path.join(outDir, 'lld_report_src.html');
  fs.writeFileSync(srcPath, html, 'utf-8');

  // 2) Edge 无头预渲染 → lld_report.html（SVG 成品版）
  console.log(`无头浏览器预渲染中（${path.basename(edge)}）…`);
  const dump = edgeDump(edge, srcPath);
  if (/^[\0]{8}/.test(dump)) {
    console.error('渲染产物异常（头部全零字节，Edge 回写中断特征），请重跑 audit');
    process.exit(1);
  }
  fs.writeFileSync(path.join(outDir, 'lld_report.html'), dump, 'utf-8');
  const svgCount = (dump.match(/<svg/g) ?? []).length;
  const processed = (dump.match(/data-processed/g) ?? []).length;
  // 真语法错误判据：元素文本 ">Syntax error in text<"（库源码字符串里的同名是假匹配）
  const syntaxErr = (dump.match(/>Syntax error in text</g) ?? []).length;

  // 3) 量化验收
  const { ortho, diag, diagIds } = countDiagonalEdges(dump);
  const xlines = xcheck(dump);
  const arrowLines = arrowCheck(edge, outDir, dump);

  // 4) 中文验收报告
  console.log('\n================ 渲染质量验收 ================');
  console.log(`SVG 图数: ${svgCount}（ORTHO 已处理 ${processed}）`);
  if (syntaxErr > 0) console.log(`✗ mermaid 语法错误图: ${syntaxErr} 张（浏览器打开报告搜索「Syntax error」定位）`);
  else console.log('mermaid 语法错误图: 0');
  console.log(`流程图边: 直角 ${ortho} / 斜线 ${diag} / 共 ${ortho + diag}`);
  if (diag > 0) console.log('  斜线边: ' + diagIds.join(', '));
  if (xlines.length > 0) {
    const cross = xlines.filter(l => l.includes('边交叉')).length;
    console.log(`交叉/穿盒审计: ${xlines.length > 0 ? '见下' : ''}`);
    for (const l of xlines) console.log('  ' + l);
    void cross;
  } else {
    console.log('交叉/穿盒审计: 全部图无严格交叉、无边穿节点盒、无深入目标盒、无越界、无贴缘');
  }
  if (arrowLines.length > 0) {
    console.log('箭头朝向审计:');
    for (const l of arrowLines) console.log('  ' + l);
  } else {
    console.log('箭头朝向审计: 全部图箭头朝向正确');
  }
  const clean = syntaxErr === 0 && diag === 0 && xlines.length === 0 && arrowLines.length === 0;
  console.log('=============================================');
  console.log(clean
    ? '验收结论: 全绿 ✓'
    : '验收结论: 有上述待评审项（贴缘/轻微箭头项目检可接受的除外；斜线为 dagre 兜底的设计内行为、共线对向重叠为渲染层无法自动修复的布局形态时，需人工确认）');
  console.log(`预渲染报告（SVG 成品，浏览器直接打开）: ${path.join(outDir, 'lld_report.html')}`);
}
