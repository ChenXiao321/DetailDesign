// 对比同一边在 src（dagre 原始）与渲染后（直角化后）的路径
const fs = require('fs');
const src = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/lld_report_src.html', 'utf-8');
const out = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/lld_report.html', 'utf-8');
const srcSvgs = [...src.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const outSvgs = [...out.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
console.log('src svg数', srcSvgs.length, ' out svg数', outSvgs.length);
const want = { 2: ['L_N5_N6_5', 'L_N5_N7_6'], 32: ['L_I2_D7_23', 'L_D7_C3_24', 'L_D9_Z2_37', 'L_D9_END_40'], 39: ['L_P1B_END_9', 'L_D1B_END_10'], 43: ['L_I1_D1_4', 'L_D1_H2_5'], 45: ['L_I1_D1_4', 'L_D2_END_12'], 46: ['L_C1_END_4', 'L_W2_END_8'], 50: ['L_C15_END_26', 'L_E17_END_27'], 51: ['L_D1_R1_6', 'L_D0_END_20', 'L_D4_E2_13', 'L_P2_D0_16'], 54: ['L_D1_R1_6', 'L_D0_END_24', 'L_D5_E7_15', 'L_P3_D0_19'] };
const grab = (svg, ids) => {
  const r = {};
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const im = m[0].match(/id="(L_[^"]+)"/);
    if (im && ids.includes(im[1])) r[im[1]] = (m[0].match(/d="([^"]+)"/) || [])[1];
  }
  return r;
};
for (const si in want) {
  console.log(`=== svg#${si} ===`);
  const a = grab(srcSvgs[si], want[si]), b = grab(outSvgs[si], want[si]);
  for (const id of want[si]) {
    console.log(' ', id);
    console.log('   原始:', (a[id] || '?').slice(0, 200));
    console.log('   渲染:', (b[id] || '?').slice(0, 200));
  }
}
