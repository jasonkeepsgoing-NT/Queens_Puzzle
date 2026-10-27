// Builds Technique-Training drills and writes them into index.html between
// /*TR_DATA_BEGIN*/ … /*TR_DATA_END*/.
//
// Usage: node tools/build-training-drills.js <poolDir> [<poolDir2> …]
//
// A drill = a pure-logic board + a step index k. At runtime the first k solver
// steps are pre-applied; the very next deduction is the target technique, and
// because the solver always takes the lowest tier first, no easier deduction
// exists at that moment. Per technique we pick 12 drills from distinct boards,
// two per board size 5…10, ordered small → large.
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const dirs=process.argv.slice(2);
if(!dirs.length){console.error('usage: node tools/build-training-drills.js <poolDir>…');process.exit(1);}
const idx=path.join(__dirname,'..','index.html');
const html=fs.readFileSync(idx,'utf8').replace('(function bootstrap(){','(function bootstrap(){return;');
const w=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});}}).window;

let _s=7;const rnd=()=>{_s=(_s*1664525+1013904223)>>>0;return _s/4294967296;};
const TECHS=['t0','t1','t2s','t2m','t3','t4','t5'];
const PER=12,SIZES=[5,6,7,8,9,10];
const cand={};TECHS.forEach(t=>cand[t]=[]);
const seen=new Set();
for(const dir of dirs)for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl'))){
  for(const line of fs.readFileSync(path.join(dir,f),'utf8').split('\n').filter(Boolean)){
    const r=JSON.parse(line);const key=r.n+':'+r.r;if(seen.has(key))continue;seen.add(key);
    const regions=[...r.r].map(Number),sol=[...r.s].map(Number);
    const steps=w.buildSolutionSteps(r.n,regions,sol);
    if(steps.some(s=>(s.tier||0)>=7))continue;              // pure logic only
    const code=(r.n===10?'a':String(r.n))+r.r+r.s;
    const used=new Set();
    steps.forEach((s,k)=>{
      const tid=w.techOfStep(s);
      if(!tid||used.has(tid)||k<1)return;                   // first occurrence per board; k≥1 so the board is not empty
      used.add(tid);
      cand[tid].push({n:r.n,code,k});
    });
  }
}
const out={},report={};
for(const t of TECHS){
  const pool=cand[t];const picked=[];
  for(const n of SIZES){
    const c=pool.filter(x=>x.n===n);
    for(let i=0;i<PER/SIZES.length&&c.length;i++)picked.push(c.splice(Math.floor(rnd()*c.length),1)[0]);
  }
  while(picked.length<PER&&pool.length){                    // top up from any size if a size ran short
    const rest=pool.filter(x=>!picked.includes(x));if(!rest.length)break;
    picked.push(rest[Math.floor(rnd()*rest.length)]);
  }
  picked.sort((a,b)=>a.n-b.n);
  out[t]=picked.map(x=>x.code+':'+x.k).join(',');
  report[t]={available:pool.length,picked:picked.length,sizes:picked.map(x=>x.n).join('')};
}
console.log(JSON.stringify(report,null,1));
let h=fs.readFileSync(idx,'utf8');
const body=TECHS.map(t=>`\n${t}:'${out[t]}'`).join(',')+'\n';
h=h.replace(/\/\*TR_DATA_BEGIN\*\/[\s\S]*?\/\*TR_DATA_END\*\//,`/*TR_DATA_BEGIN*/${body}/*TR_DATA_END*/`);
fs.writeFileSync(idx,h);
fs.writeFileSync(path.join(__dirname,'training-drills.json'),JSON.stringify(out,null,1));
