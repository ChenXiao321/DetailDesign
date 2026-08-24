// 箭头朝向审计：渲染后 HTML 中每条边的端点若明确贴目标节点某条边（顶/底/左/右），
// 末段方向必须沿该边法线（顶/底竖直进、左右水平进），否则就是「躺着的箭头」。
// 需要 getBBox，须在浏览器里跑：把审计脚本注入渲染后 HTML 末尾，Edge 无头执行后读结果。
// 用法（repo 根）：node 测试产出/Gp_EcuStpStdn/_arrowcheck.js
const fs = require('fs');
const { execFileSync } = require('child_process');

const BASE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const AUDIT = `(function(){
  const distToSeg=(p,a,b)=>{const vx=b[0]-a[0],vy=b[1]-a[1],wx=p[0]-a[0],wy=p[1]-a[1];const l2=vx*vx+vy*vy;let t=l2?(wx*vx+wy*vy)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(a[0]+t*vx-p[0],a[1]+t*vy-p[1]);};
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
      const core=em[1]; let target=null;
      for(let i=1;i<core.length-1;i++){ if(core[i]!=='_') continue; if(map[core.slice(0,i)]&&map[core.slice(i+1)]){target=map[core.slice(i+1)];break;} }
      if(!target) return;
      const E=pts[pts.length-1];
      const ds=[['V',distToSeg(E,[target.x,target.y],[target.x+target.w,target.y])],['V',distToSeg(E,[target.x,target.y+target.h],[target.x+target.w,target.y+target.h])],['H',distToSeg(E,[target.x,target.y],[target.x,target.y+target.h])],['H',distToSeg(E,[target.x+target.w,target.y],[target.x+target.w,target.y+target.h])]].sort((a,b)=>a[1]-b[1]);
      if(!(ds[0][1]<=12&&ds[1][1]-ds[0][1]>8)) return;
      const need=ds[0][0];
      const a=pts[pts.length-2],b=pts[pts.length-1];
      const dir=Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?'H':'V';
      if(dir!==need) out.push('svg#'+si+' '+p.getAttribute('id')+' need='+need+' got='+dir);
    });
  });
  const div=document.createElement('div'); div.id='auditresult';
  div.textContent='AUDITRESULT:'+(out.length?out.join(' | '):'CLEAN');
  document.body.appendChild(div);
})();`;

const dom = fs.readFileSync(BASE + '/lld_report_rendered.html', 'utf-8');
// 注意：文件里 script 字符串中也含 "</body>"，必须插到最后一个 </body> 前
const i = dom.lastIndexOf('</body>');
const page = dom.slice(0, i) + '<scr' + 'ipt>' + AUDIT + '</scr' + 'ipt>' + dom.slice(i);
const tmp = BASE + '/_audit_tmp.html';
fs.writeFileSync(tmp, page, 'utf-8');

const url = 'file:///' + tmp.replace(/\\/g, '/').replace(/#/g, '%23')
  .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
const dump = execFileSync(EDGE, ['--headless', '--disable-gpu', '--dump-dom',
  '--virtual-time-budget=20000', url], { maxBuffer: 64 * 1024 * 1024 }).toString('utf-8');
fs.unlinkSync(tmp);
const m = dump.match(/id="auditresult">AUDITRESULT:([^<]*)/);
console.log(m ? (m[1] === 'CLEAN' ? '全部图箭头朝向正确' : '箭头朝向违规:\n' + m[1].split(' | ').join('\n')) : '审计未执行（dump 中无结果）');
