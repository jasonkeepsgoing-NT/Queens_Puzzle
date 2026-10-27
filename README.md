# Queens Puzzle — Simulator & Trainer

A single-file, zero-dependency HTML **Queens** logic puzzle, with a human-style multi-tier solving engine, difficulty-graded generators, a 300-level Challenge mode, technique Training, a Daily puzzle in three difficulties, personal stats with solving advice, bilingual UI (EN / 中文) and six themes.

> Inspired by LinkedIn's daily puzzle games — the rules are the same as LinkedIn's *Queens*. This is an independent project, not affiliated with LinkedIn.

**[▶ Play it](index.html)** — just open `index.html` in any browser. No build, no server, no install.

---

## What makes this different

Most Queens implementations solve by backtracking. This one solves the way a *person* does — through an 8-tier ladder of named deduction techniques — and that solver doubles as the **difficulty gatekeeper** for puzzle generation. A board is only accepted if the human-style solver has to work hard for it.

### The solving engine — 8 tiers

The engine scans tiers in strict order 0 → 7 and returns the first technique that applies.

| Tier | Technique | What it does |
|:---:|---|---|
| 0 | ♛ Obvious Queen | A region / row / column has exactly one cell left. |
| 1 | ♛ Deduced Queen | After accounting for marks and blocks, exactly one cell remains. |
| 2 | ✕ Row/Col Exclusion | N regions confined to exactly N rows/cols — no other region may enter. |
| 3 | ✕ Killer | A queen here would starve another **region, row or column** of every cell. |
| 4 | ✕ Zone / Overflow | Multi-region overflow: some queens must escape a band, blocking cells. |
| 5 | ✕ Group Lock | K regions whose off-line cells can hold ≤ K−1 queens must consume a whole line. |
| 6 | ✕ Region Confinement | One region's open cells all lie in a single row or column. |
| 7 | ⚠ Lookahead | Trial placement forces a contradiction. **The only tier that guesses.** |

Tiers 0–6 are pure forward deduction. **No board the game serves ever needs Tier 7** — generators reject or reshape such boards, and user-built or imported boards that need it are refused. (Tier 6 is kept for completeness; in practice its cases are already caught by Tier 2.)

### Difficulty levels

One function (`classifyDifficulty`) defines the classes from the solver's own solution path; every generator, the Challenge levels, the Daily boards and the in-game Difficulty Guide use it. Each board lands in exactly one class.

| Level | Definition (n = board size) |
|---|---|
| **Easy** | Tiers 0–2 only, and every Tier-2 step involves a single region (a region lying in one line clears the rest of it). |
| **Medium** | Tiers 0–2 with at least one **multi-region** exclusion (2+ regions ↔ the same 2+ lines). No Killer. |
| **Hard** | Needs Tier 3 Killer, but fewer than ⌈n/3⌉ deep (Tier 3+) steps. |
| **Intensive** | Killer is the backbone: ≥ ⌈n/3⌉ Tier-3 steps, nothing above Tier 3. |
| **Advanced ★** | Needs Tier 4+ (Zone/Overflow or Group Lock) at least once, below the Master bar. |
| **Master ★★** | Tier 5 Group Lock, ≥ 0.35n deep steps, ≥ 0.7n Tier-2+ steps, first queen after ≥ 0.3n steps. |
| **Custom** | You choose board size, region shapes and single-cell region budget (still pure logic). |

Before this version, the Easy/Medium/Hard generators were statistically indistinguishable (measured on 540 boards: in the old "Hard" output, 85 of 180 boards were Easy by the definition above). Generation now **hill-climbs region borders into the requested class** (`fitToClass`: simplify when too hard, complexify when too easy, keeping the solution unique and regions connected).

Generation is **difficulty-first**: candidate boards are mutated and re-scored against the human solver until they clear the bar. The generator never silently downgrades — if you ask for Master, you wait until you get a real Master.

---

## Challenge mode

Six tracks (Easy → Master ★★), **50 levels each**, 10 chapters of 5. Board sizes vary between 5×5 and 10×10 while difficulty within a track stays level; **every 5th level is a 👑 boss** drawn from the hardest band of its track (and at least 7×7 / 8×8).

- Levels are pre-generated offline and graded by the in-page solver (`tools/`), so they load instantly and are identical for every player. All 300 are verified unique, connected, pure-logic and of exactly their track's class. Track ratings rise monotonically (avg solver rating 41 → 54 → 67 → 76 → 101 → 126).
- **Stars per level**: 3★ = no hints and within par time · hints or over par cost a star · viewing the solution caps the level at 1★ (asks for confirmation first).
- **Motivation layer**: level map with stars and best times, chess-piece ranks from total stars (Pawn → Grandmaster), 16 trophies, daily solving streak, free-play personal bests per size/difficulty, confetti / boss celebration, toast notifications.

## Technique Training

Seven techniques (Tier 0 → Tier 5, Tier 2 split into single- and multi-region), **12 drills each** on 5×5–10×10 boards. A drill pauses a real board right before one deduction — no easier move exists at that moment — and asks you to place the forced queen or mark every cell the technique rules out. *Check* gives graded feedback (missing cells, extra cells, a valid deduction of another technique, a ✕ on a solution queen); a correct answer shows the solver's explanation with the board highlight. Each technique has a "How it works" card. Results (first try / solved / revealed, time) feed the stats.

## Daily puzzle

One date-seeded board family per day, identical for everyone: **Normal** (Hard class) is generated from the date seed; **Easy** and **Hard** (Intensive class) are the *same layout* hill-climbed down/up into their class, so the three share a family resemblance. Built in the browser in about a second and cached for the day. 14-day calendar and daily streak.

## Personal stats & solving evaluation

Every solve is logged (size, class, time, moves, hints and the tier of each hint, wrong queens placed, solution viewed). **Speed index** = 100 × expected ÷ actual time, where expected time comes from the board's own solution path (scan cost by size + a cost per deduction tier). The stats dialog shows tiles, a 30-solve speed trend, a per-difficulty table, a technique profile (Training accuracy, time to find, hint dependence) and rule-based **advice** — the technique that blocks you (with a one-click drill), wrong-queen habits, big-board slowdown, trend, readiness for the next difficulty. *The cost model is a heuristic, not yet fitted to player data.*

## Solve review (order-independent)

Every board change is logged as *(time, cell, new state, source)*. After a win the log is replayed, and each action is judged against **the board as it was at that moment** — never against the solver's order, so solving in any order is fine. The review flags:

- **Wrong marks**: queens off the solution, and ✕ on a solution cell (the costliest mistake: it silently blocks later deductions), plus how long each stayed on the board.
- **Pauses** (≥ 3× your own median gap, min 12 s), each explained by what was true right then: a wrong mark was blocking progress · an easy move (Tier 0/1) was waiting, with the cell · a genuinely hard step, with the technique (one-click drill).
- **Redundant ✕** on cells already blocked by a queen (→ Auto Elimination) and **churn** (cells toggled 3+ times, excluding mistake fixes).

The result is a play-quality score (A–D, 0–100), up to four concrete tips and a timeline; recent reviews also feed the advice in *My Stats*.

## Web Worker generation

Generation runs on a background thread of the player's own device (a Web Worker built at runtime from the page's pure engine block, `/*ENGINE_BEGIN*/ … /*ENGINE_END*/`). No server is involved. The page stays responsive during long generations (measured: Master 10×10, 26.5 s, ~58 fps on the main thread). Daily boards are built in the worker too and are byte-identical to the main-thread result. If workers are unavailable the old main-thread loop is used.

## Queen icons

A dropdown next to the theme picker: **♛ Queen** (default), **✨ Theme** (follows the theme: ☀️ Sun · 🐚 Shell · 🌸 Flower · 🌙 Moon · 🪼 Jellyfish · 💎 Gem), any single icon, or **🎲 Random** (shown as `Random (current icon)`). Icons are SVG masks painted in the theme's queen colour, so they inherit each theme's palette.

## Saved locally

Uses `localStorage` when the browser allows it (everything still works without it):
challenge progress, stars, best times, trophies, solve log, Training results, Daily boards and calendar, streaks · language · queen icon · theme (a specific theme, or **Random** — shown as `Random (current theme)`) · last free-play size/difficulty · the board in progress (marks, moves, timer), so a reload continues where you left off. A *Reset progress* button lives in the Trophies dialog.

## Features

- **Hint system** that explains *why*, in plain language, naming the exact technique and highlighting the evidence cells on the board
- **Full solution walkthrough**, step by step, each step tagged with its tier
- **Bilingual**: complete English / 中文 for every hint, explanation and region colour name — localized at display time, so language can be switched mid-solve
- **Six themes** (three light, three dark) with auto day/night selection; all colour pairs verified for perceptual distance
- **Seeds** — every board exports to a shareable base64 string and loads back exactly
- **Drag to mark**, undo, auto-elimination, edit mode, win detection, timer that pauses when the tab hides (generation keeps running)
- Board sizes 5×5 through 12×12
- Responsive layout: three columns on wide screens (controls · board · info), board scales to the viewport height; board-first ordering on phones

## Repository layout

```
index.html          Current version — the whole game, one file
releases/           Timestamped historical builds
ARCHITECTURE.md     Engine internals, design decisions, benchmark seeds
tools/              Challenge level pipeline + headless UI test
```

### Rebuilding Challenge levels

```bash
npm install jsdom --no-save
node tools/gen-challenge-pool.js master 5,6,7,8,9,10 120 pool/master.jsonl 2400   # repeat per difficulty
node tools/build-challenge-levels.js pool/      # classifies + selects 6×50 levels, patches index.html
node tools/build-training-drills.js pool/       # 7×12 technique drills, patches index.html
node tools/test-ui.js                           # integrity + UI flow regression
```

## Development notes

There is no build step. `index.html` is the source.

Verification is done by loading the file in [jsdom](https://github.com/jsdom/jsdom) and asserting against benchmark seeds recorded in `ARCHITECTURE.md` — each has a known expected max tier, so a regression in the solver shows up immediately as a changed tier.

```bash
npm install jsdom --no-save
node --check <(sed -n '/<script>/,/<\/script>/p' index.html)   # syntax
```

## License

MIT
