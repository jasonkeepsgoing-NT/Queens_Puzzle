// Builds the 6 × 50 Challenge levels from candidate pools and writes them
// into index.html between the /*CH_DATA_BEGIN*/ … /*CH_DATA_END*/ markers.
//
// Usage: node tools/build-challenge-levels.js <poolDir> [<poolDir2> …]
//   pool dirs hold *.jsonl files produced by tools/gen-challenge-pool.js
//
// Selection model
//   Every candidate is re-classified with the page's own classifyDifficulty()
//   (the same definition the Difficulty Guide states). A track only takes
//   boards of its own class, and a board that needs trial & error has no class,
//   so it can never be selected.
//   rating = solver score + 5·(n − 7)  (a bigger board is a little harder to scan)
//   Each slot has a target rating that ramps gently across the 50 levels inside
//   the class's own rating distribution. Board size is random (5–10) among the
//   sizes that have a candidate near the target. Every 5th slot is a BOSS: its
//   target comes from the top band of the class and it has a minimum size.
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const dirs=process.argv.slice(2);
if(!dirs.length){console.error('usage: node tools/build-challenge-levels.js <poolDir>…');process.exit(1);}
const idx=path.join(__dirname,'..','index.html');
const page=fs.readFileSync(idx,'utf8').replace('(function bootstrap(){','(function bootstrap(){return;');
const w=new JSDOM(page,{runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});}}).window;

// Deterministic PRNG so a rebuild from the same pools gives the same levels.
let _s=20261027;
const rnd=()=>{_s=(_s*1664525+1013904223)>>>0;return _s/4294967296;};
const rate=r=>r.score+5*(r.n-7);
const pct=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.round(p*(sorted.length-1))))];

const byClass={};const seen=new Set();
for(const dir of dirs)for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl'))){
  for(const line of fs.readFileSync(path.join(dir,f),'utf8').split('\n').filter(Boolean)){
    const r=JSON.parse(line);const key=r.n+':'+r.r;
    if(seen.has(key)||r.n>10)continue;seen.add(key);
    const regions=[...r.r].map(Number),sol=[...r.s].map(Number);
    const a=w.analyzePuzzleDifficulty(r.n,regions,sol);
    const cls=w.classifyDifficulty(r.n,a);
    if(!cls)continue;                                       // needs trial & error → never used
    (byClass[cls]=byClass[cls]||[]).push({n:r.n,r:r.r,s:r.s,score:a.score,maxTier:a.maxTier});
  }
}
const BANDS={
  easy:     {reg:[0.05,0.75],boss:[0.80,1.00],bossMinN:7},
  medium:   {reg:[0.05,0.75],boss:[0.80,1.00],bossMinN:7},
  hard:     {reg:[0.05,0.75],boss:[0.80,1.00],bossMinN:8},
  intensive:{reg:[0.05,0.75],boss:[0.80,1.00],bossMinN:8},
  advanced: {reg:[0.05,0.75],boss:[0.80,1.00],bossMinN:8},
  master:   {reg:[0.05,0.75],boss:[0.80,1.00],bossMinN:8},
};
const used=new Set();
const LEVELS=50,BOSS_EVERY=5;
const out={},report={};
for(const diff of Object.keys(BANDS)){
  const pool=byClass[diff]||[];
  const ratings=pool.map(rate).sort((a,b)=>a-b);
  const B=BANDS[diff];
  const pick=(target,minN)=>{
    const avail=pool.filter(r=>!used.has(r.n+':'+r.r)&&r.n>=minN);
    for(let tol=0.06;tol<4;tol*=1.5){
      const near=avail.filter(r=>Math.abs(rate(r)-target)<=Math.max(4,target*tol));
      if(!near.length)continue;
      const sizes=[...new Set(near.map(r=>r.n))];
      const n=sizes[Math.floor(rnd()*sizes.length)];
      return near.filter(r=>r.n===n).sort((a,b)=>Math.abs(rate(a)-target)-Math.abs(rate(b)-target))[0];
    }
    throw new Error(`${diff}: pool exhausted (target ${target})`);
  };
  const lv=[];
  for(let i=1;i<=LEVELS;i++){
    const f=(i-1)/(LEVELS-1),boss=i%BOSS_EVERY===0;
    const [lo,hi]=boss?B.boss:B.reg;
    const r=pick(pct(ratings,lo+(hi-lo)*f),boss?B.bossMinN:5);
    used.add(r.n+':'+r.r);lv.push(r);
  }
  out[diff]=lv.map(r=>(r.n===10?'a':String(r.n))+r.r+r.s).join(',');
  const sizes={};lv.forEach(r=>sizes[r.n]=(sizes[r.n]||0)+1);
  const regs=lv.filter((_,i)=>(i+1)%BOSS_EVERY),boss=lv.filter((_,i)=>(i+1)%BOSS_EVERY===0);
  const avg=a=>Math.round(a.reduce((p,r)=>p+rate(r),0)/a.length);
  report[diff]={pool:pool.length,sizes:JSON.stringify(sizes),reg:avg(regs),boss:avg(boss),
    ramp:`${avg(regs.slice(0,8))}→${avg(regs.slice(-8))}`,maxTier:Math.max(...lv.map(r=>r.maxTier))};
}
console.table(report);
let html=fs.readFileSync(idx,'utf8');
const body=Object.keys(out).map(d=>`\n${d}:'${out[d]}'`).join(',')+'\n';
html=html.replace(/\/\*CH_DATA_BEGIN\*\/[\s\S]*?\/\*CH_DATA_END\*\//,`/*CH_DATA_BEGIN*/${body}/*CH_DATA_END*/`);
fs.writeFileSync(idx,html);
fs.writeFileSync(path.join(__dirname,'challenge-levels.json'),JSON.stringify(out,null,1));
