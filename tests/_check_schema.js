// json 结构完整性门禁（0930 结构冻结）：薄壳，检查逻辑单一实现在 core/model/schemaLint.ts，
// CLI gen / gen --only images 写盘后自检共用同一实现，杜绝脚本与管线口径漂移。
// 用法: node _check_schema.js [json路径]（缺省=基线 测试产出/Gp_EcuStpStdn/lld_design.json）
const fs = require('fs');

(async () => {
  const { lintModelSchema } = await import('./packages/core/dist/model/schemaLint.js');
  const target = process.argv[2] ?? '测试产出/Gp_EcuStpStdn/lld_design.json';
  const j = JSON.parse(fs.readFileSync(target, 'utf8'));
  // 门禁=成品口径：全字段 + 全 PNG 齐备
  const problems = lintModelSchema(j, { requirePngs: true, requireDocument: true, requireDynamic: true });
  for (const p of problems) console.log(`✗ ${p}`);
  console.log(problems.length === 0 ? `✓ 结构完整性全绿（${target}）` : `共 ${problems.length} 项缺失`);
  process.exit(problems.length ? 1 : 0);
})();
