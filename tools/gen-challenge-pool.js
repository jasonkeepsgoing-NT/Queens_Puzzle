// Offline candidate generator for Challenge-mode levels.
// Loads index.html in jsdom, then calls the in-page generator + difficulty
// analyzer repeatedly. Output: one JSON line per candidate puzzle.
//
// Usage: node tools/gen-challenge-pool.js <difficulty> <sizes,comma> <count> <outFile> [timeBudgetSec]
// Requires: npm install jsdom --no-save
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const [,,diff,sizesArg,countArg,outFile,budgetArg]=process.argv;
const sizes=sizesArg.split(',').map(Number);
const count=+countArg, budget=(+budgetArg||600)*1000;
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8')
  // Skip the page's startup (no auto-generated board); we drive generation directly.
  .replace('(function bootstrap(){','(function bootstrap(){return;');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});}});
const w=dom.window;
const t0=Date.now();let made=0;
const out=fs.createWriteStream(outFile,{flags:'a'});
while(made<count&&Date.now()-t0<budget){
  const n=sizes[made%sizes.length];
  const s0=Date.now();let res=null,tries=0;
  while(!res&&Date.now()-s0<120000){tries++;res=w.generatePuzzleSync(n,diff,0);}
  if(!res){console.error(`[${diff}] n=${n} timeout`);made++;continue;}
  const a=w.analyzePuzzleDifficulty(n,res.regions,res.solution);
  if(!a){made++;continue;}
  const lh=a.steps.some(s=>(s.tier||0)>=7);
  const rec={diff,n,ms:Date.now()-s0,tries,lh,maxTier:a.maxTier,score:Math.round(a.score*10)/10,
    adv:a.advCount,deep:a.deepCount,high:a.highCount,delay:a.stepsBeforeFirstQueen,
    fq:a.firstQueenTier,steps:a.steps.length,
    r:res.regions.join(''),s:res.solution.join('')};
  out.write(JSON.stringify(rec)+'\n');
  console.log(`[${diff}] n=${n} ${rec.ms}ms tries=${tries} maxT=${rec.maxTier} score=${rec.score} lh=${lh}`);
  made++;
}
out.end();setTimeout(()=>process.exit(0),200);
