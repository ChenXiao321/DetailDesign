// 调试：Mainfunction/Startup 的 cond 节点、边、ipdom、loopHeaders
const fs = require('fs');
const { locateFnCfg } = require('./packages/core/dist/analyzer/stateMachineBuilder.js');

const design = JSON.parse(fs.readFileSync('内网测试/v6_序列图修正/lld_design.json', 'utf-8'));
const readSource = (rel) => { try { return fs.readFileSync('测试模块/Gp_EcuStpStdn/' + rel, 'utf-8'); } catch { return null; } };

(async () => {
  for (const name of ['Gp_EcuStpShdn_Mainfunction', 'Gp_EcuStpShdn_Startup']) {
    const fn = design.providedFunctions.find(f => f.name === name);
    const { cfg } = await locateFnCfg(fn, readSource(fn.file));
    const live = cfg.nodes.filter(n => !n.dead);
    const liveSeqs = new Set(live.map(n => n.seq));
    const outEdges = new Map();
    for (const e of cfg.edges) {
      if (!liveSeqs.has(e.from) || !liveSeqs.has(e.to)) continue;
      (outEdges.get(e.from) ?? outEdges.set(e.from, []).get(e.from)).push(e);
    }
    const loopHeaders = new Set();
    for (const e of cfg.edges) if (e.from > e.to && liveSeqs.has(e.to)) loopHeaders.add(e.to);
    // pdom
    const pdom = new Map();
    const all = new Set(live.map(n => n.seq));
    for (const n of live) pdom.set(n.seq, n.seq === cfg.endSeq ? new Set([n.seq]) : new Set(all));
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of live) {
        if (n.seq === cfg.endSeq) continue;
        const succs = (outEdges.get(n.seq) ?? []).map(e => e.to);
        let inter = null;
        for (const s of succs) {
          const ps = pdom.get(s);
          inter = inter === null ? new Set(ps) : new Set([...inter].filter(x => ps.has(x)));
        }
        const next = new Set([n.seq, ...(inter ?? [])]);
        if (next.size !== pdom.get(n.seq).size) { pdom.set(n.seq, next); changed = true; }
      }
    }
    const ipdom = (seq) => {
      const s = new Set(pdom.get(seq) ?? []); s.delete(seq);
      for (const x of s) { let ok = true; for (const o of s) if (o !== x && !pdom.get(x).has(o)) { ok = false; break; } if (ok) return x; }
      return cfg.endSeq;
    };
    console.log(`\n#### ${name} endSeq=${cfg.endSeq}`);
    for (const n of live) {
      if (n.kind !== 'cond') continue;
      const es = (outEdges.get(n.seq) ?? []).map(e => `${e.label ?? (e.noArrow ? '~~~' : '?')}→${e.to}`);
      console.log(`cond seq=${n.seq} row=${n.rowFrom} ipdom=${ipdom(n.seq)} loopHdr=${loopHeaders.has(n.seq)} | ${n.label.slice(0, 60)} | ${es.join(' ')}`);
    }
    console.log('loopHeaders:', [...loopHeaders].join(','));
    // Startup else-if 链专用：否边目标的 kind
    if (name.includes('Startup')) {
      for (const n of live) {
        if (n.kind !== 'cond') continue;
        const ne = (outEdges.get(n.seq) ?? []).find(e => e.label === '否');
        if (ne) console.log(`cond ${n.seq} 否→${ne.to} kind=${cfg.nodes[ne.to]?.kind} ipdom(n)=${ipdom(n.seq)} ipdom(t)=${ipdom(ne.to)}`);
      }
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
