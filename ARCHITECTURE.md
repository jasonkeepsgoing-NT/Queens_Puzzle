# Queens Puzzle 游戏项目 — 交接文档 (Handoff Document)

**版本标注: 2026-07-18 23:58 (UTC)**
**交接对象: 零历史背景的新会话 Claude 实例**

---

## 1. 任务目标

**总目标**: 维护并持续迭代一个自包含单文件 HTML 的 "Queens Puzzle" 游戏(玩法与 LinkedIn Queens 相同,受其启发;标题/主要文案不出现 LinkedIn,仅规则面板说明中致谢),包含人类式多层逻辑解题/提示引擎、多难度生成引擎、双语(EN/中文)界面、六主题系统。

**当前阶段**: 功能完备的成熟迭代期。最新版本已包含 8 层解题引擎、6 个难度(含 Master 大师)、载入健壮性加固。刚处理完一起"移动端文件预览加载失败"报告(结论:旧版文件+飞行模式网络受限,非代码缺陷)。

---

## 2. 已确认的决策与约束(勿翻案)

| # | 决策 | 理由 |
|---|------|------|
| D1 | **单文件 HTML 交付**,无构建步骤、无 localStorage/sessionStorage | 用户以文件形式保存/打开;artifact 环境禁止浏览器存储 API |
| D2 | **每次交付都用当时日期时间命名** `queens-game-YYYYMMDD_HHMM.html`(`TS=$(date +%Y%m%d_%H%M)`),同时覆盖稳定副本 `queens-game.html`,两份都放 `/mnt/user-data/outputs/` | 用户明确的长期要求;时间戳防混淆 |
| D3 | **每次回答末尾附本次 token 用量估算** | 用户明确的长期要求;无精确计数器,给谨慎估算 |
| D4 | 用户用中文提问时**用中文回答** | 用户近期全中文交流 |
| D5 | **解题引擎 8 层 (Tier 0-7)**,严格按优先级 0→7 扫描,返回首个命中 | 层级=人类推理由浅入深;顺序错误会导致"该用简单技巧时用了高级技巧"类 bug(已发生过并修复) |
| D6 | **Tier 7 (Lookahead) 是唯一允许试错的层**;谜题若必须用到 Tier 7,难度徽章加 "." 后缀(如 `intensive.`)+ `diff-lh` 样式(琥珀色光晕)+ tooltip | 用户要求区分"纯逻辑可解"与"必须前瞻";曾用 "-LH" 后缀,因太长改为 "." |
| D7 | **生成永不降级、永不放弃**:请求什么难度就生成什么难度,失败无限重试("Still working… (cycle N)") | 用户明确要求 |
| D8 | **Master(大师 ★★)难度 = 保证零 lookahead 的最难纯逻辑**:必须 maxTier≥5 且 <7,深度步骤(tier≥3)≥⌈n×0.35⌉,tier≥2 步骤≥⌈n×0.7⌉,首皇后延迟≥⌈n×0.3⌉ | 与 Advanced(允许 lookahead)形成互补取舍;"最公平的最难" |
| D9 | **提示解释文本双语存储** `locD:{en,zh}` + 短文本 `loc:{k,v}`,**区域颜色名在显示时刻本地化并加色块**(`chipColorNames` 同时匹配 EN+ZH 名并输出当前语言) | 曾有 bug:生成时烙进英文名导致中文界面出现英文;显示时刻翻译一劳永逸 |
| D10 | **提示特效采用单覆盖层设计**:一个全板灰色 overlay(z-index:50),相关格子提升到 z-index:60;行/列推导的证据格用轻量 `hint-band`(白色内描边)而非重型 `hint-src` 环 | 用户反馈"证据格不该被压暗";整区提亮对线推导太吵 |
| D11 | **拖拽需 10px 移动阈值**(`DRAG_THRESHOLD=10`)+ 到达不同格子才触发;`forceResetDragState()` 绑定 touchcancel/document touchend/window blur | 修复"误触发拖拽"和"拖拽放的 X 卡住无法编辑"两个已报告 bug |
| D12 | **启动加固三件套**:`bootstrap()` IIFE 各步独立 try/catch(intensive 失败回退 easy)、`runGenLoop` 内 generatePuzzleSync/onPuzzleReady 均 try/catch、Google Fonts 非阻塞(`preconnect`+`onerror` 容错) | 应对"载入错误"报告;任一步失败不得白屏 |
| D13 | 计时器在页面隐藏时暂停,但**生成继续**(用 setTimeout 链而非 rAF) | 用户要求切走页面不中断生成 |
| D14 | 唯一外部资源 = Google Fonts 链接;字体栈有 fallback | 沙箱可能阻断外链,不得硬依赖 |

---

## 3. 关键产出物

**产出物本体 = 交付的 HTML 文件本身**(自包含,约 217KB / 4021 行,无法全文贴入本文档——超出任何合理文档长度)。新会话接手方式:

> **请用户重新上传最新文件** `queens-game-20260718_2358.html`(或任何最新时间戳版本),新会话将其复制到 `/home/claude/queens-game.html` 作为工作副本。文件本身即完整源码。

### 3.1 文件内部架构地图(按 `<script>` 内出现顺序,函数名可 grep 定位)

- **调色板/工具**: `RC`(区域颜色表,~65 色,含 name/fill/edge)、`COLOR_ZH`(颜色中文名映射,色彩描述式如 Sage→浅草绿)、`colorName()`、`textOn()`、`D4`、`inB()`、`range()`
- **求解基础**: `findQueens(n)`(随机合法皇后布局)、`countSols(n,map,cap)`(解计数,cap=2 判唯一)、`solveOne`、`isBlockedByQueens`
- **生成**: `buildVoronoi`(以皇后为种子的区域生长)、`enforceUnique`(调整区域至唯一解)、`complexifyRegions`(增形状复杂度)、`isConnected`
- **难度分析**: `analyzePuzzleDifficulty(n,regMap,sol)` → `{steps,stepsBeforeFirstQueen,maxTier,advCount(tier≥2),deepCount(tier≥3),highCount(tier≥4),firstQueenTier,elimRatio,tierVariety,score}`
- **难度引擎**: `generatePuzzleSync(n,diff,maxSingles)` 分发 → `generateAdvancedSync`(允许 LH,`meetsAdvancedBar`+`mutateForDifficulty`)、`generateMasterSync`(零 LH,`meetsMasterBar`+`mutateForMaster`,mutation 评分 `masterScore` 中 maxTier≥7 直接 -1 失格)、其余走 intensive/standard 路径
- **解题引擎核心**: `getNextHintForState(n,regMap,state)` — 8 层按序扫描:
  - T0 Obvious Queen(♛ 区域/行/列仅剩一格)
  - T1 Deduced Queen(♛ 排除后仅剩一格;行/列推导时 `srcCells`=整条判定线其余格 + `srcLine:{kind,idx}` 标志)
  - T2 Row/Col Exclusion(✕ N 区域↔N 线,Hall 子集,双向)
  - T3 Region Killer(✕ 试放皇后使某**区域或行或列**无存活开格;killSets 键=颜色名或 `__rowN`/`__colN`;**两个关键修复**:①只统计仍 cellOpen 的格子,②行/列封杀是后补的对称检测)
  - T4 Zone/Overflow(✕ Overflow Escape / Group Lock 旧变体 / Zone Overflow)
  - T5 Group Lock(✕ **多区域组锁定**:K 区域各有开格在同一线上,线外 rest 格经 `maxIndep` 回溯精确计算最多容纳 ≤K-1 皇后 → 该线被组占据,排除其他区域在线上的格子;loc 键 `hGroupLock:{grp,grpL,K,line,lineL}`)
  - T6 Region Confinement(✕ 单区域全部开格在一条线)
  - T7 Lookahead(⚠ 试放+连锁矛盾,最后手段)
- **解题步骤构建**: `buildSolutionStepsInternal(n,regMap,sol)` / `buildSolutionSteps`(循环调 getNextHintForState 并模拟应用)
- **提示显示**: `hintShort(h)`/`hintDetail(h)`(显示时刻本地化)、`fmtDetailPositions`/`fmtShort`(坐标高亮 A-L 全列 + 调 `chipColorNames`)、`chipColorNames(html)`(**单遍 token 化替换**:按 `<[^>]*>` 切分避开标签,EN 名加 `\b` 边界,CJK 名不加,长名优先,输出当前语言色块 span)
- **提示特效**: `applyHintFx(hint)`(srcLine→`hint-band` 轻量;否则 `hint-src` 脉冲环;`hint-keep` 提亮相关整区但 srcLine 时跳过)、`clearHintFx`/`clearHintDisplay`、`ensureHintOverlay`、`FX_CLASSES` 数组、`maybeDismissHintFromBlank`(捕获阶段 mousedown/touchstart,空白处点击即清提示)、解题步特效 12s 定时器 `hintClearTimer`
- **交互**: `onMouseDown/onMouseUp/onTouchStart/onTouchMove/onTouchEnd`、`clickCycle`(空/auto→X→♛→空)、`commitDrag`、`visitDragCell`、`forceResetDragState`、`DRAG_THRESHOLD=10`、`lastPointer{x,y}`
- **胜利**: `checkWin`(清特效+定时器,350ms 后再清一次并显示 banner)
- **生成循环**: `runGenLoop`(setTimeout 链,try/catch 保护,永不放弃)、`initPuzzle`、`onPuzzleReady`(计算 `needsLookahead=steps.some(t≥7)` → 徽章加 "." + `diff-lh` 类)
- **主题**: `THEMES` 注册表(light1 Daylight/light2 Seafoam/light3 Blossom/dark1 Midnight/dark2 Abyss/dark3 Aubergine,全部色对感知距离≥13)、`setTheme`(强制 html+body 背景+meta theme-color)、`applyAutoTheme`(按季节日出日落模型选明暗池再随机)、`toggleMode`
- **i18n**: `I18N{en,zh}`、`curLang`、`tf(key,vars)`、`applyLang`(翻译 [data-i18n] 等并重渲染)、tier0-7/tierD0-7 双语齐全
- **种子**: base64 JSON `{n,regions,solution,diff}`,seed 载入路径同样计算 LH 后缀
- **启动**: 文件末尾 `bootstrap()` IIFE(见 D12)

### 3.2 已验证行为基线(回归时对照)

- 载入:jsdom 下 0 错误,64 格渲染,loading 隐藏
- 8×8 intensive 单次生成:平均 ~108ms,最坏 ~282ms,20/20 成功
- Master 生成:n=8 约 8s、n=9 约 6s、n=10 约 18s,全部 maxTier=5、零 LH
- 基准种子 A(8×8,曾误判需 LH,现 T5 Group Lock 解):`eyJuIjo4LCJyZWdpb25zIjpbMiwwLDAsMiwxLDEsMSwxLDIsMiwyLDIsMiwyLDEsMSw1LDIsNSw0LDQsNCw0LDEsNSw1LDUsNSw1LDUsNCwzLDUsNCw1LDQsNCw0LDQsMyw1LDQsNCw0LDcsNCwzLDMsNSw0LDQsNCw3LDYsMywzLDQsNCw3LDcsNyw2LDYsNl0sInNvbHV0aW9uIjpbMiw2LDEsNyw0LDAsNSwzXSwiZGlmZiI6ImludGVuc2l2ZS4ifQ==` → 期望 maxTier=5,无 "."
- 基准种子 B(8×8,曾误判,现 T3 行/列修复后 Region Killer F3,G3,C4,D4 解):`eyJuIjo4LCJyZWdpb25zIjpbMCwwLDAsMCwwLDAsMSwzLDIsMCwwLDAsMSwxLDEsMywyLDIsMiwwLDEsMywzLDMsMiwyLDEsMSwxLDIsMiwzLDQsMiwyLDIsMiwyLDIsMyw0LDQsNCwyLDUsNSwyLDYsNywyLDIsMiw1LDYsNiw2LDcsNyw1LDUsNSw1LDYsNl0sInNvbHV0aW9uIjpbMyw1LDIsNywwLDQsNiwxXSwiZGlmZiI6ImludGVuc2l2ZS4ifQ==` → 期望 maxTier=3,无 lookahead
- 基准种子 C(10×10,**真正需要 LH**,勿"修复"):`eyJuIjoxMCwicmVnaW9ucyI6WzAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMSwwLDIsMiwwLDIsMCwwLDEsMSwxLDAsMywyLDIsMiwyLDAsMCwwLDEsNSwzLDQsNCw0LDMsMywzLDAsMCw1LDMsMywzLDMsMywzLDMsNiw2LDUsNyw3LDcsMywzLDYsNiw2LDYsNSw1LDUsNyw3LDcsNyw3LDcsNiw1LDUsNSw5LDksNyw4LDcsOCw2LDksOSw5LDksOSw4LDgsOCw4LDhdLCJzb2x1dGlvbiI6WzYsOSw0LDEsMywwLDcsNSw4LDJdLCJkaWZmIjoiaW50ZW5zaXZlIn0=` → 期望 maxTier=7,徽章 `intensive.`(已用纯传播求解器+1-ply 枚举严格证明其残局无单步逻辑可解)

### 3.3 测试方法(环境每轮重置,需重装)

```bash
cd /home/claude && npm install jsdom --no-save
# JS 语法: 提取 <script> 后 node --check
# CSS: python 统计 <style> 内 { } 配对
# 载入测试: JSDOM runScripts:'dangerously', stub requestAnimationFrame/cancelAnimationFrame/scrollTo/matchMedia
# jsdom 限制: 无 document.elementFromPoint(拖拽测试需 stub);"Could not parse CSS"警告无害(color-mix)
# 测试脚本放 /home/claude(不要 /tmp)
```

---

## 4. 已排除的方案(勿重蹈)

| 方案 | 否决原因 |
|------|----------|
| 后缀 "-LH" 标记需前瞻的谜题 | 徽章太长显示溢出;已改为 "." 单点后缀 |
| 提示证据格用重型 `hint-src` 脉冲环标整条判定线 | 视觉过吵;改用轻量 `hint-band` 白色内描边 |
| `hint-keep` 对线推导也提亮整个相关区域 | 压暗对比失效、焦点分散;srcLine 时跳过整区提亮 |
| 生成失败时降级难度或放弃 | 用户明确否决;必须真难度+无限重试 |
| chipColorNames 多遍逐色 replace | 会重扫已插入的 span 属性造成嵌套损坏;改为单遍 token 化+按标签切分 |
| 生成时把 colorName() 结果烙进 locD.zh | curLang 为 en 时烙进英文名,中文界面显示英文;改为显示时刻翻译 |
| Tier3 用区域全格表判断"区域被清空" | 忽略已 ✕ 格导致漏判(两个种子曾因此误入 lookahead);必须只数 cellOpen 存活格 |
| 把"载入错误"归因于代码 bug 反复改逻辑 | jsdom 全绿无法复现;真因是旧版文件+移动端预览网络受限(飞行模式);正解=加固+引导用户开新文件/联网重试 |
| rAF 驱动生成循环 | 页面隐藏时 rAF 暂停会中断生成;用 setTimeout 链 |

---

## 5. 待办事项(按优先级)

| P | 事项 | 验收标准 |
|---|------|----------|
| P1 | 确认用户在**联网状态**下能打开最新文件 `queens-game-20260718_2358.html`(移动端预览或浏览器) | 用户回报棋盘正常显示;若仍失败,收集浏览器/App 版本与控制台报错再定位 |
| P2 | (若 P1 复现失败)考虑输出一个**精简版**(去注释/压缩)降低移动预览体积压力 | 压缩版 <150KB 且功能回归全绿 |
| P3 | Master 难度 n≥11 的生成耗时评估与优化(当前仅测到 n=10 ≈18s) | n=11/12 有实测数据;若 >60s 需优化 seedTries/mutation 预算或文案提示 |
| P4 | Tier 4 内部旧的 Group Lock 变体与新 T5 Group Lock 存在概念重叠,可考虑合并/去重 | 合并后基准种子 A/B/C 行为不变,批量 20 谜题回归无新增 LH |
| P5 | 配对容量封杀(pair-capacity killer:试放后两区域合计 maxIndep<2)作为潜在新层 | 设计文档+性能评估(计算量大);能将某类 T7 谜题降为纯逻辑 |

---

## 6. 已知风险与未决问题

- 「待验证」**移动端 "Couldn't load file" 的确切根因**:截图显示飞行模式开启+打开的是旧版 0220 文件。服务端 jsdom 全绿。合理推断=网络受限的预览下载失败,但未获用户联网复测确认。
- 「待验证」**217KB 单文件在各移动端预览器的兼容上限**:若确有体积问题,走 P2 精简版。
- 「待验证」Master 难度在 n≥11 的可用性(生成耗时未实测)。
- 已知限制:jsdom 无法测真实渲染/触摸/字体加载;`color-mix` 等现代 CSS 在老浏览器降级表现未实测。
- 环境事实:每轮会话容器可能重置(node_modules 消失需重装 jsdom);`/mnt/user-data/outputs` 在新会话**不可访问**,接手依赖用户重新上传文件。
- 历史教训:曾发生"工作副本修改后未打包进交付文件"导致加固丢失(cp 回旧版覆盖)。**每轮开头 `cp outputs→工作副本` 前,先确认 outputs 是最新**;每轮结尾必须完成 cp 双份+present_files。

---

## 7. 术语表

| 术语 | 含义 |
|------|------|
| Tier 0-7 | 解题引擎 8 个推理层级,数字越大越高级;T7=Lookahead 唯一试错层 |
| Group Lock / 区域组锁定 | T5:K 区域线外剩余格互斥(≤K-1)→ 整线被组占据 |
| Region Killer / 区域封杀 | T3:试放皇后使某区域/行/列无存活格 → 该格排除;`__rowN`/`__colN` 为行列受害者的 killSets 键 |
| LH / lookahead / "." 后缀 | 前瞻推理;徽章 `intensive.` 表示该谜题必须用 T7 |
| Master / 大师 ★★ | 新难度:保证零 LH 但强制 maxTier≥5 的最难纯逻辑 |
| Advanced / 进阶 ★ | 允许 LH 的高难度(与 Master 互补) |
| `maxIndep` | 小格集内最大互不冲突皇后数,回溯精确计算(冲突=同行/列/区域/相邻) |
| `srcCells` / `srcLine` / `hint-band` | 提示证据格 / 线推导标志 / 证据格轻量高亮样式 |
| `chipColorNames` | 显示时刻把文本中区域颜色名(EN 或 ZH)替换为当前语言+区域色背景的色块 span |
| `cellOpen` vs `cellLogical` | 前者尊重 ✕ 标记的"当前可用";后者仅按已放皇后的几何封锁 |
| seed / 种子 | base64(JSON{n,regions,solution,diff}),可分享载入 |
| bigSlow | n≥11 且 intensive/custom/advanced/master 的慢生成路径标志 |
| 稳定副本 | `/mnt/user-data/outputs/queens-game.html`(始终=最新时间戳版内容) |
| 双份交付 | 每轮 = 时间戳版 + 稳定副本,均在 outputs,并 present_files 时间戳版 |

---

*本文档自包含。新会话接手第一步:请用户上传最新 `queens-game-*.html`,复制到 `/home/claude/queens-game.html`,`npm install jsdom --no-save`,跑 §3.3 载入测试对照 §3.2 基线。*

---

## 8. 2026-10-26 迭代记录 (Challenge / 持久化 / 宽屏布局)

**版本标注: 2026-10-26 23:53 UTC,见页面「规则」面板底部 Version 行**

| # | 决策 | 理由 |
|---|------|------|
| D1′ | **D1 修订**: 允许 `localStorage`(键 `queensPuzzle.save.v1`),所有读写 try/catch;存储被禁时游戏照常运行(仅内存) | 用户明确要求本地保存关卡进度、主题等 |
| D15 | **Challenge 闯关**: 6 条难度线 × 50 关,10 章 × 5 关,每章第 5 关为 Boss;关卡离线预生成后内嵌(`CH_DATA`,约 26KB),不在浏览器实时生成 | 秒开、人人相同、可离线挑选难度;Master 实时生成 10–30s 不适合闯关节奏 |
| D16 | 关卡难度 = `analyzePuzzleDifficulty().score + 5·(n−7)`;Easy/Medium/Hard 从**合并候选池**按评分分位切分 | 实测三种生成器的求解指标几乎无差别(maxTier 中位均为 2),直接用会导致三条线难度相同 |
| D17 | 星级: 3★ = 无提示且 ≤ 标准用时;提示 1–2 次或超时各降 1★;查看解答封顶 1★(需二次确认) | 鼓励纯逻辑、可重玩刷星 |
| D18 | 宽屏 ≥1180px 三栏(控制/闯关 · 棋盘 · 信息);棋盘上限 `min(800px, max(420px, 100vh−230px))`;手机端棋盘紧随控制区,闯关面板在棋盘下 | 修复宽屏中部大片空白 |
| D19 | 标题/副标题/重要文案去除 LinkedIn;仅规则面板 `aboutNote` 说明受其启发、规则相同 | 用户要求 |

工具链: `tools/gen-challenge-pool.js`(jsdom 内调用页面生成器产出候选)→ `tools/build-challenge-levels.js`(挑选并写入 index.html)→ `tools/test-ui.js`(300 关唯一解/连通/可解 + 闯关流程/持久化回归)。

「待验证」par 时间系数 `CH_PAR_K` 与评分中尺寸项 `5·(n−7)` 为经验值,尚无真人数据校准。

---

## 9. 2026-10-27 迭代记录 (难度重定义 / 训练 / 每日 / 统计 / 图标)

**版本标注: 2026-10-27 04:47 UTC**

| # | 决策 | 理由 |
|---|------|------|
| D20 | **绝对禁止试错**: 生成器、闯关、每日、训练只输出 Tier 7 不需要的棋盘;用户自建(Build)与载入种子若需 Tier 7 直接拒绝;"." 徽章机制删除 | 用户要求「所有关卡禁止出现必须试错，绝对禁止」;**取代 D6 / D8 中关于 Advanced 允许前瞻的部分** |
| D21 | **难度唯一定义 `classifyDifficulty`**(见 README 表),生成器用 `fitToClass` 爬山把棋盘推入目标等级 | 实测旧 easy/medium/hard 生成器输出无差别(旧 hard 输出 85/180 实为 easy) |
| D22 | 技巧训练: 7 技巧 × 12 题,离线挑选(`tools/build-training-drills.js`),运行时预应用前 k 步;答案集合 = 该状态下同技巧的全部提示 | 求解器总取最低层级,保证此刻没有更简单的推理 |
| D23 | 每日一练: 日期哈希 → mulberry32 临时替换 `Math.random`(`withSeed`)→ Normal(hard 类);Easy/Hard = 同一布局 `fitToClass` 到 easy / intensive | 用户要求「日期种子 + 简化/复杂化 3 难度」;同代码同日期全设备一致 |
| D24 | 个人统计: 速度指数 = 100×预期/实际;预期 = 5 + 0.25n² + Σ STEP_COST[tier]。「待验证」系数为经验值 | 用户要求速度评估 + 建议 |
| D25 | 皇后图标: SVG alpha mask(shape/cut)以 `--queen-c` 着色;下拉含 皇后(默认)/主题/6 图标/随机(当前) | 与主题配色自动一致 |
| D26 | Tier 6 (Region Confinement) 在 1058 个样本中出现 0 次(被 Tier 2 单区域排除覆盖),训练与说明不再单列 | 数据驱动 |

「待验证」12×12 的 easy / intensive 生成在 jsdom 中单次 >120s 未完成;9–11 正常(秒级)。

---

## 10. 2026-10-27 第二轮 (Web Worker / 解题复盘)

**版本标注: 2026-10-27 19:12 UTC**

| # | 决策 | 理由 |
|---|------|------|
| D27 | 生成走 Web Worker: 运行时把 `/*ENGINE_BEGIN*/…/*ENGINE_END*/` 纯引擎块 + 辅助函数 toString 拼成 blob worker;`cancelGeneration()` 终止并按需重建;不可用时回退主线程 `runGenLoop` | 用户同意开启;Worker 是玩家本机后台线程,不是服务器 |
| D28 | 解题复盘与顺序无关: 记录每次棋盘变化 `[t,cell,state,src]`,赛后按当时盘面逐步判定;停顿用引擎判断当时可证明什么 | 用户要求「不按 solution 顺序评估,而是指出可优化的操作」 |
| D29 | 图标候选(24 个)仅在 scratchpad 预览,用户选定前不进分支 | 用户要求 |

「待验证」复盘扣分权重(8/6/4/2)与停顿阈值(3×中位间隔, ≥12s)为经验值。
