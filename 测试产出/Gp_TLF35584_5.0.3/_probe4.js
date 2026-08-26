// 从 _debug_orig.html 提取违规边的 dagre 原始路径 vs 渲染后路径
const fs = require('fs');
const html = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/_debug_orig.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const want = { 2: ['L_N5_N6_5', 'L_N5_N7_6'], 32: ['L_I2_D7_23', 'L_D7_C3_24', 'L_D9_Z2_37', 'L_D9_END_40'], 39: ['L_P1B_END_9', 'L_D1B_END_10'], 43: ['L_I1_D1_4', 'L_D1_H2_5'], 45: ['L_I1_D1_4', 'L_D2_END_12'], 46: ['L_C1_END_4', 'L_W2_END_8'], 50: ['L_C15_END_26', 'L_E17_END_27'], 51: ['L_D1_R1_6', 'L_D0_END_20', 'L_D4_E2_13', 'L_P2_D0_16'], 54: ['L_D1_R1_6', 'L_D0_END_24', 'L_D5_E7_15', 'L_P3_D0_19'] };
for (const si in want) {
  console.log(`=== svg#${si} ===`);
  for (const m of svgs[si].matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const im = tag.match(/id="(L_[^"]+)"/);
    if (!im || !want[si].includes(im[1])) continue;
    const cur = (tag.match(/ d="([^"]+)"/) || [])[1];
    const orig = (tag.match(/data-orig="([^"]+)"/) || [])[1];
    console.log(' ', im[1]);
    console.log('   原始:', (orig || '?').slice(0, 220));
    console.log('   渲染:', (cur || '?').slice(0, 220));
  }
}
