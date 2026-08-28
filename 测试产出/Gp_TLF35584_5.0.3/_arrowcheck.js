// 箭头朝向审计（不变量式，不复刻渲染器决策）：渲染后 HTML 中每条边的端点若贴目标节点
// 包围盒（最近边 ≤12px），则对矩形族目标（无 polygon 子元素；菱形/平行四边形 bbox 不贴
// 实际形状，跳过）必须满足——
//   末段竖直（▼）→ 箭尖贴在顶/底边上（≤2.5px）且横向不超出盒跨距；
//   末段水平（→）→ 箭尖贴在左/右边上（≤2.5px）且纵向不超出盒跨距。
// 一条规则同时抓住两类问题：横着扎进顶边的「躺平箭头」（方向与所贴边不符）、
// 以及箭尖悬在盒外不贴边的「离得远」。
// 需要 getBBox，须在浏览器里跑：把审计脚本注入渲染后 HTML 末尾，Edge 无头执行后读结果。
// 用法（repo 根）：node 测试产出/Gp_TLF35584_5.0.3/_arrowcheck.js
const fs = require('fs');
const { execFileSync } = require('child_process');

const BASE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const AUDIT = `(function(){
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
        // polygon 目标 bbox 不贴形，不做贴边不变量；但「横段躺平进真实水平顶/底边」要抓——
        // 平行四边形顶/底边是水平边（该 y 有两个顶点），菱形顶/底是尖点（一个顶点）跳过。
        // （IoMcuAdc GetAdcRaw D3--否-->W2 曾横段贴 W2 顶边躺平进入，bbox 不贴形漏审）
        if(dir!=='H') return;
        const gm=(dstG.getAttribute('transform')||'').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
        const tm=(poly.getAttribute('transform')||'').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
        const ox=(gm?+gm[1]:0)+(tm?+tm[1]:0), oy=(gm?+gm[2]:0)+(tm?+tm[2]:0);
        const vp=(poly.getAttribute('points')||'').trim().split(/\\s+/).map((q)=>{const w=q.split(',');return [+w[0]+ox,+w[1]+oy];});
        ['T','B'].forEach((which)=>{
          const yy=which==='T'?t.y:t.y+t.h;
          const ep=vp.filter((q)=>Math.abs(q[1]-yy)<0.6);
          if(ep.length!==2) return;  // 菱形尖顶/尖底，无水平边
          const x1=Math.min(ep[0][0],ep[1][0]), x2=Math.max(ep[0][0],ep[1][0]);
          if(Math.abs(E[1]-yy)<=2.5&&E[0]>=x1-2&&E[0]<=x2+2)
            out.push('svg#'+si+' '+id+' 横段躺平进'+(which==='T'?'顶':'底')+'边（polygon 目标）');
        });
        return;
      }
      if(Math.min(dL,dR,dT,dB)>12) return;  // 端点不贴盒不审计
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
