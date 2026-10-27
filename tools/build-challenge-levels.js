// Builds the 6 × 50 Challenge levels from candidate pools and writes them
// into index.html between the /*CH_DATA_BEGIN*/ … /*CH_DATA_END*/ markers.
//
// Usage: node tools/build-challenge-levels.js <poolDir>
//   <poolDir> holds *.jsonl files produced by tools/gen-challenge-pool.js
//   (easy, medium, hard, intensive, advanced*, master*).
//
// Selection model
//   rating = solver score (analyzePuzzleDifficulty) + 5·(n − 7)
//            → a bigger board is a little harder to scan at equal logic depth.
//   Easy/Medium/Hard are drawn from ONE merged pool (the three generators
//   produce statistically similar boards) and split by rating percentile,
//   so the three tracks are genuinely ordered. Intensive/Advanced/Master use
//   their own generator's pool.
//   Each slot has a target rating that ramps gently from the band's low end
//   to its high end across 50 levels. Board size is random (5–10) among the
//   sizes that have a candidate near the target, so size varies while
//   difficulty stays similar. Every 5th slot is a BOSS: target taken from the
//   top band of the track and a minimum board size.
//   Lookahead-only boards (needs Tier 7) are excluded except in Advanced.
const fs=require('fs'),path=require('path');
const poolDir=process.argv[2];
if(!poolDir){console.error('usage: node tools/build-challenge-levels.js <poolDir>');process.exit(1);}

// Deterministic PRNG so a rebuild from the same pool gives the same levels.
let _s=20261026;
const rnd=()=>{_s=(_s*1664525+1013904223)>>>0;return _s/4294967296;};

const read=prefix=>fs.readdirSync(poolDir).filter(f=>f.startsWith(prefix)&&f.endsWith('.jsonl'))
  .flatMap(f=>fs.readFileSync(path.join(poolDir,f),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)));
const dedupe=rows=>{const seen=new Set();return rows.filter(r=>{const k=r.n+':'+r.r;if(seen.has(k))return false;seen.add(k);return true;});};
const rate=r=>r.score+5*(r.n-7);
const pct=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.round(p*(sorted.length-1))))];

const basic=dedupe([...read('easy'),...read('medium'),...read('hard')]).filter(r=>!r.lh);
const pools={
  easy:basic,medium:basic,hard:basic,
  intensive:dedupe(read('intensive')).filter(r=>!r.lh),
  advanced:dedupe(read('advanced')),
  master:dedupe(read('master')).filter(r=>!r.lh),
};
// [regular band lo, hi] and [boss band lo, hi] as rating percentiles of the pool
const BANDS={
  easy:     {reg:[0.02,0.30],boss:[0.40,0.55],bossMinN:7},
  medium:   {reg:[0.30,0.60],boss:[0.65,0.80],bossMinN:7},
  hard:     {reg:[0.58,0.85],boss:[0.86,0.99],bossMinN:8},
  intensive:{reg:[0.30,0.85],boss:[0.88,1.00],bossMinN:8},
  advanced: {reg:[0.08,0.65],boss:[0.75,1.00],bossMinN:8},
  master:   {reg:[0.05,0.65],boss:[0.75,1.00],bossMinN:8},
};
const used=new Set();
const LEVELS=50,BOSS_EVERY=5;
const out={},report={};
for(const diff of Object.keys(BANDS)){
  const pool=pools[diff];
  const ratings=pool.map(rate).sort((a,b)=>a-b);
  const B=BANDS[diff];
  const pick=(target,minN,tolFrac)=>{
    const avail=pool.filter(r=>!used.has(r.n+':'+r.r)&&r.n>=minN);
    for(let tol=tolFrac;tol<2;tol*=1.5){
      const near=avail.filter(r=>Math.abs(rate(r)-target)<=Math.max(4,target*tol));
      if(!near.length)continue;
      const sizes=[...new Set(near.map(r=>r.n))];
      const n=sizes[Math.floor(rnd()*sizes.length)];
      const cands=near.filter(r=>r.n===n).sort((a,b)=>Math.abs(rate(a)-target)-Math.abs(rate(b)-target));
      return cands[0];
    }
    throw new Error(`${diff}: no candidate near ${target}`);
  };
  const lv=[];
  for(let i=1;i<=LEVELS;i++){
    const f=(i-1)/(LEVELS-1);
    const boss=i%BOSS_EVERY===0;
    const [lo,hi]=boss?B.boss:B.reg;
    const target=pct(ratings,lo+(hi-lo)*f);
    const r=pick(target,boss?B.bossMinN:5,0.06);
    used.add(r.n+':'+r.r);
    lv.push(r);
  }
  out[diff]=lv.map(r=>(r.n===10?'a':String(r.n))+r.r+r.s).join(',');
  const sizes={};lv.forEach(r=>sizes[r.n]=(sizes[r.n]||0)+1);
  const regs=lv.filter((_,i)=>(i+1)%BOSS_EVERY);
  const boss=lv.filter((_,i)=>(i+1)%BOSS_EVERY===0);
  const avg=a=>Math.round(a.reduce((p,r)=>p+rate(r),0)/a.length);
  report[diff]={pool:pool.length,sizes,regRating:avg(regs),bossRating:avg(boss),
    regFirst10:avg(regs.slice(0,8)),regLast10:avg(regs.slice(-8)),
    lh:lv.filter(r=>r.lh).length,maxTier:Math.max(...lv.map(r=>r.maxTier))};
}
console.log(JSON.stringify(report,null,1));
const idx=path.join(__dirname,'..','index.html');
let html=fs.readFileSync(idx,'utf8');
const body=Object.keys(out).map(d=>`\n${d}:'${out[d]}'`).join(',')+'\n';
html=html.replace(/\/\*CH_DATA_BEGIN\*\/[\s\S]*?\/\*CH_DATA_END\*\//,`/*CH_DATA_BEGIN*/${body}/*CH_DATA_END*/`);
fs.writeFileSync(idx,html);
fs.writeFileSync(path.join(__dirname,'challenge-levels.json'),JSON.stringify(out,null,1));
console.log('wrote',Object.values(out).reduce((p,s)=>p+s.length,0),'chars of level data');
