// 一次性：复现 htmlReport 5.2.1.1 外部类型探测逻辑，列出三模块全部命中
const fs = require('fs');
const STD_TYPES = ['Std_ReturnType', 'boolean', 'uint8', 'uint16', 'uint32', 'uint64',
  'sint8', 'sint16', 'sint32', 'sint64', 'float32', 'float64'];
for (const dir of process.argv.slice(2)) {
  const m = JSON.parse(fs.readFileSync(dir + '/lld_model.json', 'utf-8'));
  const scanText = [
    ...[...m.providedFunctions, ...m.internalFunctions].map(f => f.signature),
    ...[...m.internalVariables, ...m.providedVariables].map(v => v.type),
    ...m.types.flatMap(t => [t.underlyingType ?? '', ...(t.elements ?? []).map(e => e.type)]),
  ].join(' ');
  const localTypeNames = new Set(m.types.map(t => t.name));
  const fnNames = new Set([...m.providedFunctions, ...m.internalFunctions, ...m.calledExternalFunctions].map(f => f.name));
  const groups = new Map();
  for (const tok of scanText.match(/[A-Za-z_]\w*/g) ?? []) {
    if (!/Type$/.test(tok)) continue;
    if (localTypeNames.has(tok) || STD_TYPES.includes(tok)) continue;
    const mod = tok.includes('_') ? tok.split('_')[0] : '其他';
    if (!groups.has(mod)) groups.set(mod, new Set());
    groups.get(mod).add(tok + (fnNames.has(tok) ? '  <== 函数名!' : ''));
  }
  console.log('=== ' + dir + ' (module=' + m.module + ') ===');
  for (const [mod, types] of [...groups.entries()].sort()) console.log('  [' + mod + '] ' + [...types].join(', '));
}
