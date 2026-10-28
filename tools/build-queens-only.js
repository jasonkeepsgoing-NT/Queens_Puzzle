// Builds the "Queens-only" training ladder (✕ marking disabled) and writes it
// into index.html between /*QO_DATA_BEGIN*/ … /*QO_DATA_END*/.
//
// Usage: node tools/build-queens-only.js <poolDir> [<poolDir2> …]
//
// Without ✕ marks every elimination has to be held in your head, so what makes
// a board hard here is the length of the deduction chains between queens:
//   gap   = longest run of non-queen deductions before some queen
//   delay = deductions before the FIRST queen
//   load  = 3·gap + 1.5·delay + 0.5·(all non-queen steps) + 3·maxTier + 0.5·n
// 20 pure-logic boards are picked at evenly spaced load percentiles (easy → very hard).
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const dirs=process.argv.slice(2);
if(!dirs.length){console.error('usage: node tools/build-queens-only.js <poolDir>…');process.exit(1);}
const idx=path.join(__dirname,'..','index.html');
const page=fs.readFileSync(idx,'utf8').replace('(function bootstrap(){','(function bootstrap(){return;');
const w=new JSDOM(page,{runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});}}).window;
let _s=99;const rnd=()=>{_s=(_s*1664525+1013904223)>>>0;return _s/4294967296;};
const pool=[],seen=new Set();
for(const dir of dirs)for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl'))){
  for(const line of fs.readFileSync(path.join(dir,f),'utf8').split('\n').filter(Boolean)){
    const r=JSON.parse(line);const key=r.n+':'+r.r;if(seen.has(key)||r.n>10)continue;seen.add(key);
    const steps=w.buildSolutionSteps(r.n,[...r.r].map(Number),[...r.s].map(Number));
    if(steps.some(s=>(s.tier||0)>=7))continue;
    let gap=0,run=0,delay=-1,xs=0;
    steps.forEach(s=>{if(s.type==='queen'){if(delay<0)delay=run;gap=Math.max(gap,run);run=0;}else{run++;xs++;}});
    const maxTier=Math.max(...steps.map(s=>s.tier||0));
    pool.push({n:r.n,code:(r.n===10?'a':String(r.n))+r.r+r.s,gap,delay,load:3*gap+1.5*delay+0.5*xs+3*maxTier+0.5*r.n});
  }
}
pool.sort((a,b)=>a.load-b.load);
const LEVELS=20,picked=[];
for(let i=0;i<LEVELS;i++){
  const p=0.02+0.98*i/(LEVELS-1);
  const target=pool[Math.round(p*(pool.length-1))].load;
  const near=pool.filter(x=>!picked.includes(x)&&Math.abs(x.load-target)<=Math.max(1.5,target*0.05));
  const sizes=[...new Set(near.map(x=>x.n))];
  const n=sizes[Math.floor(rnd()*sizes.length)];
  picked.push(near.filter(x=>x.n===n).sort((a,b)=>Math.abs(a.load-target)-Math.abs(b.load-target))[0]);
}
console.table(picked.map((x,i)=>({lv:i+1,n:x.n,gap:x.gap,delay:x.delay,load:x.load})));
let html=fs.readFileSync(idx,'utf8');
html=html.replace(/\/\*QO_DATA_BEGIN\*\/[\s\S]*?\/\*QO_DATA_END\*\//,`/*QO_DATA_BEGIN*/'${picked.map(x=>x.code).join(',')}'/*QO_DATA_END*/`);
fs.writeFileSync(idx,html);
