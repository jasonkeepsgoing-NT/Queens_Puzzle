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
        if(steps.some(s=>(s.tier||0)>=7))bad.push(d+'#'+(i+1)+' needs trial & error');
        const cls=classifyDifficulty(p.n,analyzePuzzleDifficulty(p.n,p.regions,p.solution));if(cls!==d)bad.push(d+'#'+(i+1)+' class '+cls);
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
  ok(ev(w,`curLang`)==='zh'&&/闯关/.test(w.document.getElementById('tab-btn-ch').textContent),'saved language restored');
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

  // ── 9. Technique training: every drill has a unique-tier answer; correct answers pass, wrong ones fail ──
  const drill=ev(w,`(()=>{const bad=[];let n=0;
    for(const tc of TECHS){const codes=trCodes(tc.id);if(codes.length!==12)bad.push(tc.id+' count '+codes.length);
      codes.forEach((_,j)=>{n++;loadDrill(tc.id,j);
        const {tier}=collectAllHintsAtBestTier();
        if(tier!==tc.tier)bad.push(tc.id+'#'+j+' best tier '+tier);
        if(!trMode.valid.length||trMode.valid.some(h=>techOfStep(h)!==tc.id))bad.push(tc.id+'#'+j+' no valid answer');
        const h=trMode.valid[0];
        if(tc.type==='queen'){cellState[h.row*N+h.col]=2;setCellDOM(h.row,h.col,2);}
        else h.cells.forEach(([r,c])=>{cellState[r*N+c]=1;setCellDOM(r,c,1);});
        trCheck();
        if(!trMode.done||trRec(tc.id).r[j].s!==2)bad.push(tc.id+'#'+j+' correct answer rejected: '+(trMode.fb&&trMode.fb.msg));
      });}
    // a wrong answer: ✕ on a solution cell
    loadDrill('t3',0);const r0=0,c0=solution[0];
    if(trMode.start[r0*N+c0]===0){cellState[r0*N+c0]=1;trCheck();if(trMode.done||trMode.fb.kind!=='bad')bad.push('wrong answer accepted');}
    return {bad,n};})()`);
  ok(drill.n===84&&drill.bad.length===0,`training: 84 drills verified (target tier, correct accepted, wrong rejected) ${drill.bad.slice(0,4).join('; ')}`);
  ok(ev(w,`trMode&&document.getElementById('ch-hud').textContent.includes('Check')||document.getElementById('ch-hud').textContent.includes('检查')`),'training HUD shows Check button');

  // ── 10. Daily: deterministic, three classes, same layout family ──
  const daily=await ev(w,`(async()=>{const a=await buildDaily('2026-10-27');const b=await buildDaily('2026-10-27');
    const cls=k=>classifyDifficulty(a.n,analyzePuzzleDifficulty(a.n,a.v[k].r,a.v[k].s));
    const same=JSON.stringify(a)===JSON.stringify(b);
    const diffCells=k=>a.v[k].r.filter((x,i)=>x!==a.v.normal.r[i]).length;
    return {same,n:a.n,c:[cls('easy'),cls('normal'),cls('hard')],d:[diffCells('easy'),diffCells('hard')]};})()`);
  ok(daily.same&&daily.c.join()==='easy,hard,intensive',`daily deterministic & classes easy/hard/intensive (n=${daily.n}, changed cells vs normal: ${daily.d}) ${daily.c}`);
  await ev(w,`playDaily('easy')`);
  ok(ev(w,`dailyMode&&dailyMode.vid==='easy'`),'daily easy loaded');
  solveNow(w);
  ok(ev(w,`!!(SAVE.dailyLog[todayKey()]||{}).easy`),'daily completion recorded');

  // ── 11. Stats & evaluation ──
  ok(ev(w,`SAVE.log.length>=3`),'solve log populated: '+ev(w,`SAVE.log.length`));
  ev(w,`openStatsModal()`);
  ok(/Evaluation|评估/.test(w.document.getElementById('stats-body').textContent)&&w.document.querySelector('#stats-body svg.sv'),'stats modal renders advice + trend chart');
  ev(w,`closeStatsModal()`);

  // ── 13. Solve review: order-independent move analysis ──
  const rv=ev(w,`(()=>{loadChallengeLevel('medium',1);
    const act=(i,st,tm)=>{timerSeconds=tm;cellState[i]=st;setCellDOM(i/N|0,i%N,st);moves++;updateStats(false);};
    const q0=0*N+solution[0];
    act(q0,1,4);                      // wrong ✕ on a solution cell
    act(q0,0,45);                     // fixed after a long pause (stall caused by the wrong mark)
    // place queens in REVERSE row order (not the solver's order) with short gaps
    let tm=46;for(let r=N-1;r>=1;r--){act(r*N+solution[r],2,tm+=3);}
    const rq=(N-1)*N+((solution[N-1]+2)%N);   // a cell in the last queen's row → blocked by it
    if(cellState[rq]===0)act(rq,1,tm+=2);     // redundant ✕
    const tc=1*N+((solution[1]+3)%N);
    if(cellState[tc]===0){act(tc,1,tm+=1);act(tc,0,tm+=1);act(tc,1,tm+=1);act(tc,0,tm+=1);}  // churn
    act(q0,2,tm+=60);                 // last queen after a 60 s pause (row 1 has one cell left → missed easy)
    checkWin();const r=SAVE.lastReview;
    return r&&{mk:r.mistakes.length,ep:r.episodes.map(e=>[e.start,e.end,e.w]),waste:r.waste,easy:r.missedEasy,
      stalls:r.stalls.map(x=>x.k).join(','),tips:r.tips.map(x=>x.k).join(','),hasScore:'sc' in r};})()`);
  ok(rv&&rv.mk===1&&rv.ep.length===1&&rv.ep[0][0]===0&&rv.ep[0][1]===45&&rv.waste===45&&/mistake/.test(rv.stalls)&&rv.easy>=1&&!rv.hasScore,
    'solve review: mistake episode 0:00→0:45 (waste 45 s), stall blamed on it, missed immediate queen, no score — '+JSON.stringify(rv));
  // reset during an episode counts until the same number of correct queens is back
  const rv2=ev(w,`(()=>{loadChallengeLevel('medium',2);
    const act=(i,st,tm)=>{timerSeconds=tm;cellState[i]=st;setCellDOM(i/N|0,i%N,st);moves++;updateStats(false);};
    act(0*N+solution[0],2,5);act(1*N+solution[1],2,9);            // 2 correct queens
    const bad=2*N+((solution[2]+3)%N);act(bad,2,20);                // wrong queen at t=20 (previous action t=9)
    timerSeconds=50;restartBoard();                                  // reset at t=50
    act(0*N+solution[0],2,60);act(1*N+solution[1],2,70);            // back to 2 correct queens at t=70
    for(let r=2;r<N;r++)act(r*N+solution[r],2,70+r);checkWin();
    return SAVE.lastReview.episodes.map(e=>[e.start,e.end,e.w]);})()`);
  ok(JSON.stringify(rv2)==='[[9,70,61]]','mistake waste includes the reset: '+JSON.stringify(rv2));
  ev(w,`openReviewModal()`);
  ok(/Timeline|时间线/.test(w.document.getElementById('review-body').textContent),'review modal renders');
  ev(w,`closeReviewModal()`);

  // ── 14. Queens-only training: ✕ disabled, 20 levels ──
  const qo=ev(w,`(()=>{loadQueensOnly(0);const n0=N;
    const r0=0,c0=(solution[0]+2)%N;clickCycle(r0,c0,cellState[r0*N+c0]);const placed=cellState[r0*N+c0];
    clickCycle(r0,c0,cellState[r0*N+c0]);
    onMouseDown(1,(solution[1]+2)%N);const dm=dragMode;forceResetDragState();
    for(let r=0;r<N;r++){cellState[r*N+solution[r]]=2;setCellDOM(r,solution[r],2);}updateStats(false);checkWin();
    return {levels:qoCodes().length,placed,dm,rec:!!qoRec()[0],hud:!!lastWin.qo};})()`);
  ok(qo.levels===20&&qo.placed===2&&qo.dm==='noop'&&qo.rec&&qo.hud,'queens-only: click places a queen (no ✕), drag-marking off, clear recorded '+JSON.stringify(qo));

  // ── 12. Icons ──
  ev(w,`$('icon-select').value='theme';$('icon-select').dispatchEvent(new Event('change'))`);
  ok(ev(w,`$('board-grid').getAttribute('data-qicon')===THEME_QICON[currentTheme]`),'theme-matched icon applied: '+ev(w,`$('board-grid').getAttribute('data-qicon')`));
  ev(w,`$('icon-select').value='random';$('icon-select').dispatchEvent(new Event('change'))`);
  ok(/\(|（/.test(ev(w,`$('icon-select').selectedOptions[0].textContent`)),'random icon shows current: '+ev(w,`$('icon-select').selectedOptions[0].textContent`));
  ev(w,`$('icon-select').value='queen';$('icon-select').dispatchEvent(new Event('change'))`);
  ok(ev(w,`!$('board-grid').hasAttribute('data-qicon')`),'queen icon default restores glyph');

  // ── 8. Storage blocked → still playable ──
  const dom2=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w2){w2.scrollTo=()=>{};w2.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
      Object.defineProperty(w2,'localStorage',{get(){throw new Error('blocked');}});}});
  await sleep(1500);
  ok(dom2.window.document.querySelectorAll('#board-grid .cell').length>0,'storage blocked: board still renders');

  console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');
  process.exit(fails?1:0);
})();
