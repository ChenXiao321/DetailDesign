// 临时：截图 _regress_tmp/typecard.html → _shots/typecard_merged.png
const { execFileSync } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('_regress_tmp/typecard.html').replace(/\\/g, '/');
const edge = process.env.LLD_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
execFileSync(edge, ['--headless', '--disable-gpu', '--window-size=1150,900', '--screenshot=' + path.resolve('_shots/typecard_merged.png'), html], { stdio: 'pipe' });
console.log('shot ok');
