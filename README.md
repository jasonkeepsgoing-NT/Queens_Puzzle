# Queens Puzzle — Simulator & Trainer

A single-file, zero-dependency HTML **Queens** logic puzzle, with a human-style multi-tier solving engine, difficulty-graded generators, a 300-level Challenge mode, bilingual UI (EN / 中文) and six themes.

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

Tiers 0–6 are pure forward deduction. A board that cannot be finished without Tier 7 is flagged with a **dot** on its difficulty badge (e.g. `intensive.`) so you always know whether a puzzle is fair.

### Difficulty levels

| Level | Definition |
|---|---|
| **Easy** | Almost entirely "only cell left" spotting. |
| **Medium** | Adds basic elimination before the forced cells appear. |
| **Hard** | Requires multi-region reasoning (N regions ↔ N lines). |
| **Intensive** | Dense deduction chains including killer logic. |
| **Advanced ★** | Deliberately slow to open; *may* require lookahead. |
| **Master ★★** | **Guaranteed 100% pure logic** — never needs trial and error — yet forces the deepest techniques (Group Lock / Region Confinement). The fairest hardest level. |
| **Custom** | You choose board size and single-cell region budget. |

Generation is **difficulty-first**: candidate boards are mutated and re-scored against the human solver until they clear the bar. The generator never silently downgrades — if you ask for Master, you wait until you get a real Master.

---

## Challenge mode

Six tracks (Easy → Master ★★), **50 levels each**, 10 chapters of 5. Board sizes vary between 5×5 and 10×10 while difficulty within a track stays level; **every 5th level is a 👑 boss** drawn from the hardest band of its track (and at least 7×7 / 8×8).

- Levels are pre-generated offline and graded by the in-page solver (`tools/`), so they load instantly and are identical for every player. All 300 are verified unique, connected and solvable by the logic engine (only Advanced may need lookahead).
- **Stars per level**: 3★ = no hints and within par time · hints or over par cost a star · viewing the solution caps the level at 1★ (asks for confirmation first).
- **Motivation layer**: level map with stars and best times, chess-piece ranks from total stars (Pawn → Grandmaster), 16 trophies, daily solving streak, free-play personal bests per size/difficulty, confetti / boss celebration, toast notifications.

## Saved locally

Uses `localStorage` when the browser allows it (everything still works without it):
challenge progress, stars, best times, trophies, stats and streak · language · theme (a specific theme, or **Random** — shown as `Random (current theme)`) · last free-play size/difficulty · the board in progress (marks, moves, timer), so a reload continues where you left off. A *Reset progress* button lives in the Trophies dialog.

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
node tools/build-challenge-levels.js pool/      # selects 6×50 levels, patches index.html
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
