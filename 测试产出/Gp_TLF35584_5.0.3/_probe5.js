// 离线复刻 ortho 候选评估：对指定边打印每个候选的 拟合分/穿盒/末段方向
const fs = require('fs');
const html = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/_debug_orig.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);

const median = (vals) => { const v = [...vals].sort((a, b) => a - b); return v[v.length >> 1]; };
const round2 = (n) => Math.round(n * 100) / 100;
const distToSeg = (p, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], wx = p[0] - a[0], wy = p[1] - a[1];
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
const dirOf = (c) => {
  const a = c[c.length - 2], b = c[c.length - 1];
  return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'H' : 'V';
};

function boxesOf(svg) {
  const map = {};
  const gRe = /<g class="node[^"]*" id="flowchart-([A-Za-z0-9_]+)-\d+" transform="translate\((-?[\d.]+), (-?[\d.]+)\)"([\s\S]*?)(?=<g class="node|<g class="edgeLabel|<\/svg>)/g;
  let gm;
  while ((gm = gRe.exec(svg))) {
    const id = gm[1], tx = +gm[2], ty = +gm[3], body = gm[4];
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    const rm = body.match(/<rect[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    const pm = body.match(/<polygon points="([^"]+)"[^>]*transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
    if (rm) { x1 = +rm[1]; y1 = +rm[2]; x2 = x1 + +rm[3]; y2 = y1 + +rm[4]; }
    else if (pm) {
      const pp = [...pm[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(q => [+q[1] + +pm[2], +q[2] + +pm[3]]);
      x1 = Math.min(...pp.map(p => p[0])); x2 = Math.max(...pp.map(p => p[0]));
      y1 = Math.min(...pp.map(p => p[1])); y2 = Math.max(...pp.map(p => p[1]));
    } else continue;
    map[id] = { x: x1 + tx, y: y1 + ty, w: x2 - x1, h: y2 - y1 };
  }
  return map;
}
const crossDetail = (boxes, srcId, dstId) => (cand) => {
  const hits = [];
  for (let i = 0; i < cand.length - 1; i++) {
    const a = cand[i], b = cand[i + 1];
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    for (const id in boxes) {
      if (id === srcId || id === dstId) continue;
      const bx = boxes[id];
      if (x1 < bx.x + bx.w - 2 && x2 > bx.x + 2 && y1 < bx.y + bx.h - 2 && y2 > bx.y + 2) hits.push(`${id}@seg${i}`);
    }
  }
  return hits;
};

const want = { 2: ['L_N5_N6_5', 'L_N5_N7_6'], 32: ['L_I2_D7_23', 'L_D7_C3_24', 'L_D9_Z2_37', 'L_D9_END_40'], 39: ['L_P1B_END_9', 'L_D1B_END_10'], 43: ['L_I1_D1_4', 'L_D1_H2_5'], 45: ['L_I1_D1_4', 'L_D2_END_12'], 46: ['L_C1_END_4', 'L_W2_END_8'], 50: ['L_C15_END_26', 'L_E17_END_27'], 51: ['L_D1_R1_6', 'L_D0_END_20', 'L_D4_E2_13', 'L_P2_D0_16'], 54: ['L_D1_R1_6', 'L_D0_END_24', 'L_D5_E7_15', 'L_P3_D0_19'] };
const only = process.argv[2]; // 可选：只看某条边 svgIdx:edgeId
for (const si in want) {
  const svg = svgs[si];
  const boxes = boxesOf(svg);
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const im = tag.match(/id="(L_[^"]+)"/);
    if (!im || !want[si].includes(im[1])) continue;
    if (only && only !== `${si}:${im[1]}`) continue;
    const om = tag.match(/data-orig="([^"]+)"/);
    if (!om) continue;
    const pts = [...om[1].matchAll(/([\d.]+),([\d.]+)/g)].map(p => [+p[1], +p[2]]);
    // 拆源/目标
    const core = im[1].match(/^L_(.+)_\d+$/)[1];
    let srcId, dstId;
    for (let i = 1; i < core.length - 1; i++) {
      if (core[i] !== '_') continue;
      if (boxes[core.slice(0, i)] && boxes[core.slice(i + 1)]) { srcId = core.slice(0, i); dstId = core.slice(i + 1); break; }
    }
    const S = pts[0], E = pts[pts.length - 1];
    const mids = pts.slice(1, -1);
    const uniq = (arr) => [...new Set(arr)];
    const mxs = uniq([round2((S[0] + E[0]) / 2), ...(mids.length ? [round2(median(mids.map((p) => p[0])))] : [])]);
    const mys = uniq([round2((S[1] + E[1]) / 2), ...(mids.length ? [round2(median(mids.map((p) => p[1])))] : [])]);
    const cands = [
      ['V-H', [S, [S[0], E[1]], E]],
      ['H-V', [S, [E[0], S[1]], E]],
      ...mxs.map((mx) => [`mx${mx}`, [S, [mx, S[1]], [mx, E[1]], E]]),
      ...mys.map((my) => [`my${my}`, [S, [S[0], my], [E[0], my], E]]),
    ];
    const cross = crossDetail(boxes, srcId, dstId);
    console.log(`=== svg#${si} ${im[1]} (${srcId}→${dstId}) S=${S} E=${E} mids=${mids.length} ===`);
    for (const [name, c] of cands) {
      const hits = cross(c);
      console.log(`  ${name}  fit=${fitScore(c, pts).toFixed(0)}  末段=${dirOf(c)}  穿盒=${hits.length ? hits.join(',') : '无'}`);
    }
  }
}
