// Headless regression test (jsdom): page load, challenge data integrity,
// challenge win flow + stars/unlocks/trophies, persistence across reloads,
// theme "Random (current)" label, language persistence.
// Usage: node tools/test-ui.js        (requires: npm install jsdom --no-save)
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let fails=0;
const ok=(cond,msg)=>{console.log((cond?'PASS ':'FAIL ')+msg);if(!cond)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function boot(storage){
  const errors=[];
  const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){
      w.scrollTo=()=>{};
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
      w.HTMLCanvasElement.prototype.getContext=()=>null;
      w.confirm=()=>true;
      if(storage)for(const k in storage)w.localStorage.setItem(k,storage[k]);
      w.addEventListener('error',e=>errors.push(e.message));
    }});
  return {dom,w:dom.window,errors};
}
const dump=w=>{const o={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);o[k]=w.localStorage.getItem(k);}return o;};
const ev=(w,code)=>w.eval(code);
// Solve the board on screen by placing every solution queen, then run checkWin.
const solveNow=w=>ev(w,`for(let r=0;r<N;r++){cellState[r*N+solution[r]]=2;setCellDOM(r,solution[r],2);}checkWin();solved`);

(async()=>{
  // ── 1. Fresh load ──
  let {w,errors}=boot();
  await sleep(1500);
  ok(errors.length===0,'fresh load: no script errors '+(errors[0]||''));
  ok(w.document.querySelectorAll('#board-grid .cell').length===64,'fresh load: 8×8 board rendered');
  ok(!/linkedin/i.test(w.document.title)&&!/linkedin/i.test(w.document.querySelector('header').textContent),'no LinkedIn in title/header');
  ok(/LinkedIn/.test(w.document.querySelector('.about-note').textContent),'inspiration note present in rules panel');
  ok(/^🎲 Random \(.+\)$/.test(w.document.getElementById('theme-opt-random').textContent)&&w.document.getElementById('theme-select').value==='random',
    'theme select shows "Random (current)": '+w.document.getElementById('theme-opt-random').textContent);

  // ── 2. Level data integrity ──
  const integrity=ev(w,`(()=>{const bad=[];const sizes={};let total=0;
    for(const d of CH_TRACKS){const codes=chCodes(d);if(codes.length!==50)bad.push(d+': '+codes.length+' levels');
      codes.forEach((c,i)=>{total++;const p=chDecode(c);sizes[p.n]=(sizes[p.n]||0)+1;
        if(c.length!==1+p.n*p.n+p.n){bad.push(d+'#'+(i+1)+' length');return;}
        const reg=Int32Array.from(p.regions);
        if(countSols(p.n,reg,2)!==1)bad.push(d+'#'+(i+1)+' not unique');
        const s=solveOne(p.n,reg);if(!s||s.join()!==p.solution.join())bad.push(d+'#'+(i+1)+' solution mismatch');
        for(let r=0;r<p.n;r++){const q=r*p.n+p.solution[r];if(!isConnected(reg,reg[q],p.n,q))bad.push(d+'#'+(i+1)+' region '+reg[q]+' disconnected');}
        const steps=buildSolutionSteps(p.n,p.regions,p.solution);
        if(steps.filter(s=>s.type==='queen').length!==p.n)bad.push(d+'#'+(i+1)+' engine cannot finish');
        if(d!=='advanced'&&steps.some(s=>(s.tier||0)>=7))bad.push(d+'#'+(i+1)+' needs lookahead');
      });}
    return {bad,sizes,total};})()`);
  ok(integrity.total===300&&integrity.bad.length===0,`300 levels unique/solvable/connected (${JSON.stringify(integrity.sizes)}) ${integrity.bad.slice(0,5).join('; ')}`);

  // ── 3. Challenge win: level 1, no hints, under par → 3★, level 2 unlocked ──
  ev(w,`loadChallengeLevel('easy',1)`);
  ok(ev(w,`chMode&&chMode.level===1`)&&w.document.getElementById('ch-hud').style.display==='flex','level 1 loaded with HUD');
  ok(ev(w,`chUnlocked('easy')`)===1,'only level 1 unlocked initially');
  ev(w,`loadChallengeLevel('easy',3)`);
  ok(ev(w,`chMode.level`)===1,'locked level 3 cannot be loaded');
  ok(solveNow(w)===true,'level 1 solved');
  ok(ev(w,`SAVE.ch.easy.lv[1].s`)===3,'3 stars awarded (no hints, within par)');
  ok(ev(w,`chUnlocked('easy')`)===2,'level 2 unlocked');
  const ach=ev(w,`Object.keys(SAVE.ach).sort().join()`);
  ok(/first_win/.test(ach)&&/ch_start/.test(ach)&&/perfect1/.test(ach),'trophies unlocked: '+ach);
  ok(/Level Clear/.test(w.document.getElementById('win-title').textContent),'win card shows Level Clear');
  ok(ev(w,`SAVE.prefs.lastCh.level`)===2,'next level remembered');

  // ── 4. Hints reduce stars; viewing solution caps at 1★ ──
  ev(w,`loadChallengeLevel('easy',2);showHint();showHint();showHint();`);
  ok(ev(w,`assist.hints`)===3,'hint usage counted');
  solveNow(w);
  ok(ev(w,`SAVE.ch.easy.lv[2].s`)===1,'3 hints → 1 star');
  ev(w,`loadChallengeLevel('easy',3);$('sol-toggle').click();`);
  ok(ev(w,`solutionVisible`)===false,'first click on Show only arms confirmation');
  ev(w,`$('sol-toggle').click();`);
  ok(ev(w,`solutionVisible&&assist.sol`)===true,'second click reveals and marks assist');
  solveNow(w);
  ok(ev(w,`SAVE.ch.easy.lv[3].s`)===1,'solution viewed → 1 star');
  ev(w,`loadChallengeLevel('easy',2)`);
  solveNow(w);
  ok(ev(w,`SAVE.ch.easy.lv[2].s`)===3,'replay improves best stars');

  // ── 5. Boss level 5 ──
  ev(w,`loadChallengeLevel('easy',4)`);solveNow(w);
  ev(w,`loadChallengeLevel('easy',5)`);
  ok(ev(w,`chIsBoss(chMode.level)`)&&/BOSS/.test(w.document.getElementById('ch-hud').textContent),'boss HUD on level 5');
  solveNow(w);
  ok(/Boss Defeated/.test(w.document.getElementById('win-title').textContent),'boss win title');
  ok(ev(w,`!!SAVE.ach.boss1`),'boss trophy');

  // ── 6. Mid-level resume across reload ──
  ev(w,`loadChallengeLevel('easy',6);cellState[0]=1;setCellDOM(0,0,1);moves=1;updateStats(false);saveResume();`);
  ev(w,`themePref='dark2';setTheme('dark2');SAVE.prefs.theme='dark2';$('lang-select').value='zh';$('lang-select').dispatchEvent(new Event('change'));`);
  const store=dump(w);w.close();
  ({w,errors}=boot(store));
  await sleep(600);
  ok(errors.length===0,'reload: no script errors '+(errors[0]||''));
  ok(ev(w,`chMode&&chMode.diff==='easy'&&chMode.level===6`),'reload resumes challenge level 6');
  ok(ev(w,`cellState[0]===1&&moves===1`),'reload restores marks and moves');
  ok(ev(w,`currentTheme`)==='dark2'&&w.document.getElementById('theme-select').value==='dark2','saved theme restored');
  ok(ev(w,`curLang`)==='zh'&&/闯关/.test(w.document.getElementById('ch-title').textContent),'saved language restored');
  ok(ev(w,`chCleared('easy')`)===5,'challenge progress persisted (5 cleared)');
  w.document.getElementById('theme-select').value='random';
  w.document.getElementById('theme-select').dispatchEvent(new w.Event('change'));
  ok(/^🎲 随机（.+）$/.test(w.document.getElementById('theme-opt-random').textContent),'zh random label: '+w.document.getElementById('theme-opt-random').textContent);

  // ── 7. Leaving challenge via Generate; free-play PB ──
  w.document.getElementById('btn-generate').click();
  await sleep(1500);
  ok(ev(w,`chMode===null&&SAVE.prefs.lastCh===null`),'Generate leaves challenge mode');
  ok(w.document.getElementById('ch-hud').style.display==='none','HUD hidden in free play');
  solveNow(w);
  ok(ev(w,`Object.keys(SAVE.pb).length`)===1,'free-play personal best recorded');

  // ── 8. Storage blocked → still playable ──
  const dom2=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w2){w2.scrollTo=()=>{};w2.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
      Object.defineProperty(w2,'localStorage',{get(){throw new Error('blocked');}});}});
  await sleep(1500);
  ok(dom2.window.document.querySelectorAll('#board-grid .cell').length>0,'storage blocked: board still renders');

  console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');
  process.exit(fails?1:0);
})();
