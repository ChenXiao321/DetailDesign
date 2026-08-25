// 箭头朝向审计：渲染后 HTML 中每条边的端点若明确贴目标节点某条边（顶/底/左/右），
// 末段方向必须沿该边法线（顶/底竖直进、左右水平进），否则就是「躺着的箭头」。
// 角部模糊（顶/底边与侧边距离相近）时按与 htmlReport.ts ORTHO 相同的规则推预期方向：
// 矩形族目标 + 来源在角侧盒外 + 该侧边无其他入边 → 预期 H（平移横进）；
// 但平移路由（S0→角→侧缘点）与其他节点盒（2px 缩边）相交时与渲染器一致回落 V，否则预期 V。
// 需要 getBBox，须在浏览器里跑：把审计脚本注入渲染后 HTML 末尾，Edge 无头执行后读结果。
// 用法（repo 根）：node 测试产出/Gp_EcuStpStdn/_arrowcheck.js
const fs = require('fs');
const { execFileSync } = require('child_process');

const BASE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const AUDIT = `(function(){
  const distToSeg=(p,a,b)=>{const vx=b[0]-a[0],vy=b[1]-a[1],wx=p[0]-a[0],wy=p[1]-a[1];const l2=vx*vx+vy*vy;let t=l2?(wx*vx+wy*vy)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(a[0]+t*vx-p[0],a[1]+t*vy-p[1]);};
  const axis=(s)=>(s==='T'||s==='B'?'V':'H');
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
    const sidesOf=(E,tBox)=>[
      ['T',distToSeg(E,[tBox.x,tBox.y],[tBox.x+tBox.w,tBox.y])],
      ['B',distToSeg(E,[tBox.x,tBox.y+tBox.h],[tBox.x+tBox.w,tBox.y+tBox.h])],
      ['L',distToSeg(E,[tBox.x,tBox.y],[tBox.x,tBox.y+tBox.h])],
      ['R',distToSeg(E,[tBox.x+tBox.w,tBox.y],[tBox.x+tBox.w,tBox.y+tBox.h])],
    ].sort((a,b)=>a[1]-b[1]);
    // 第一遍：解析所有边，建入边占边表
    const edges=[];
    svg.querySelectorAll('path.flowchart-link').forEach((p)=>{
      if((p.getAttribute('class')||'').includes('edge-thickness-invisible')) return;
      const d=p.getAttribute('d'); if(!d) return;
      const pts=[...d.matchAll(/([\\d.]+),([\\d.]+)/g)].map(q=>[+q[1],+q[2]]);
      if(pts.length<2) return;
      const em=(p.getAttribute('id')||'').match(/^L_(.+)_[0-9]+$/); if(!em) return;
      const core=em[1];
      for(let i=1;i<core.length-1;i++){
        if(core[i]!=='_') continue;
        const srcId=core.slice(0,i), dstId=core.slice(i+1);
        if(map[srcId]&&map[dstId]){ edges.push({p,pts,srcId,dstId,id:p.getAttribute('id')}); }
        break;
      }
    });
    const occ={};
    edges.forEach((e)=>{
      const ds=sidesOf(e.pts[e.pts.length-1],map[e.dstId]);
      if(ds[0][1]<=12) (occ[e.dstId]=occ[e.dstId]||[]).push({id:e.id,side:ds[0][0]});
    });
    // 第二遍：逐边推预期方向并比对
    edges.forEach((e)=>{
      const tBox=map[e.dstId];
      const S0=e.pts[0], E=e.pts[e.pts.length-1];
      const ds=sidesOf(E,tBox);
      if(ds[0][1]>12) return;
      let need;
      if(ds[1][1]-ds[0][1]>8){
        need=axis(ds[0][0]);
      }else if(axis(ds[0][0])!==axis(ds[1][0])){
        const sideCh=axis(ds[0][0])==='H'?ds[0][0]:ds[1][0];
        const sgn=sideCh==='L'?-1:1;
        const outSide=sgn<0?S0[0]<tBox.x-4:S0[0]>tBox.x+tBox.w+4;
        const dstG=svg.querySelector('g.node[id^="flowchart-'+e.dstId+'-"]');
        const rectFam=dstG&&!dstG.querySelector('polygon');
        const sideFree=!(occ[e.dstId]||[]).some((o)=>o.side===sideCh&&o.id!==e.id);
        need='V';
        if(rectFam&&outSide&&sideFree){
          // 与渲染器一致：平移路由（S0→角→侧缘点）穿其他节点盒则回落 V
          const nx=sgn>0?tBox.x+tBox.w:tBox.x;
          const corner=[S0[0],E[1]];
          const hitBox=(a,b)=>{
            const x1=Math.min(a[0],b[0]),x2=Math.max(a[0],b[0]);
            const y1=Math.min(a[1],b[1]),y2=Math.max(a[1],b[1]);
            for(const id in map){
              if(id===e.srcId||id===e.dstId) continue;
              const bx=map[id];
              if(x1<bx.x+bx.w-2&&x2>bx.x+2&&y1<bx.y+bx.h-2&&y2>bx.y+2) return true;
            }
            return false;
          };
          if(!hitBox(S0,corner)&&!hitBox(corner,[nx,E[1]])) need='H';
        }
      }else return;
      const a=e.pts[e.pts.length-2], b=e.pts[e.pts.length-1];
      const dir=Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?'H':'V';
      if(dir!==need) out.push('svg#'+si+' '+e.id+' need='+need+' got='+dir);
    });
  });
  const div=document.createElement('div'); div.id='auditresult';
  div.textContent='AUDITRESULT:'+(out.length?out.join(' | '):'CLEAN');
  document.body.appendChild(div);
})();`;

const dom = fs.readFileSync(BASE + '/lld_report.html', 'utf-8');
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
