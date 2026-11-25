# AGENTS.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Implicit Rules
- Stack: Vite 8, React 19, TypeScript strict, CSS Modules + design tokens, hash router, small custom store persisted to localStorage key manateq-one:v1 (state version 5), Vitest with happy-dom, Playwright e2e against single-file build preview/index.html. No new dependencies. No linter configured.
- Commands: npm run check = typecheck, unit, build, single-file build, e2e. npm run build:single makes preview/index.html. node scripts/build-data.mjs regenerates data. node scripts/build-design-book.mjs builds design book PDF from preview/index.html. MQ_APP_FILE=<path> points e2e and design book at another build.
- FRESH CLONE CANNOT BUILD: data folders not in repository. Ask owner for the data zip they were given (unzips data/source and src/data/generated at repo root), then npm install.
- URL query for demos/tests (before the hash): reset=1 fresh demo world (only on real page load), demo=tenant|prospect|guest, lang=ar|en, theme=light|dark, text=0..3, speed=N.
- Copy: bilingual, Modern Standard Arabic, no em dashes in user-facing copy, never the words case or ticket.
- Work on branch claude/wonderful-dirac-lowpbw; no pull request unless asked; commit messages carry no model identifiers.
- Talk to owner in Gulf Arabic, concise, saying exactly what is being done; formal documents in Modern Standard Arabic.
- Scratch tooling and review decision lists of this session lived in ephemeral scratch folder, not in repository; durable record of intended behaviour = README sections on engine rules and review, plus regression tests.

### Key Decisions
- Decision: guide-derived data never pushed — Reason: repository is public and source documents are unpublished drafts. .gitignore excludes data/source/, src/data/generated/, preview/, docs/design/. Before every push count tracked files under those four folders, expect 0. Any local branch holding the data stays local.
- Decision: workflow step text copied word for word from official book; never reword steps or edit data/source/guide-services.json; engine changes routing only where step text itself says so — Reason: government service, fidelity is the requirement. App copy (titles, button labels) lives in data/source/meta/*.json; regenerate with scripts/build-data.mjs.
- Decision: no credential or card fields; sign-in, payment, e-signature, government data are simulations labelled as such; Prototype capsule on every screen; original app mark instead of company logo; demo companies obviously illustrative — Reason: prototype must not look like or be mistaken for the live official service.
- Decision: src/design/Sheet/useConfirmedTask.ts is the only place that runs a confirmed payment/signature: exactly once, after the wait, or at once if sheet unmounts, open turns false, or pagehide fires; callbacks get away=true then; keeps callbacks of last render in which sheet was open. PaySheet, StepPaySheet, SignSheet use it; never add private timer to such a sheet — Reason: pressing Pay/Sign is the decision; leaving must not lose or double it.
- Decision: persistStore in src/app/store.ts debounces 200 ms; saves at once on pagehide including changes made by later listeners of same event (leaving flag, cleared on pageshow); flushes pending on visibilitychange hidden — Reason: window-target listeners run in registration order in Chrome, capture flag does not reorder them.
- Decision: tasks of one step complete together or not at all. Only lease renewal (B3 step 8: accept, sign, pay) has a signature that is not last: SignSheet then prop makes confirmation say payment is left; leaving before paying records nothing and shows a toast (one wording on request page, another elsewhere) — Reason: persisting a partial signature rejected; state-model change too large for the stage.
- Decision: screens keyed by path in src/App.tsx, so any path change remounts the screen (no stale sheet on another record). Sign-in hand-off deliberately cancelled by leaving — Reason: avoid stale state across records and unintended hand-offs.
- Decision: design uses Apple-like tiles, cards, sheets; company maroon/gold/paper colours; Arabic typeface Tajawal with Inter; breakpoints 735/834/1069/1440; one Arabic word for Continue everywhere — Reason: owner-requested look and consistency.
- Decision: review method = independent read-only reviewers on built file, then skeptic who must reproduce every claim; every fix gets regression test proven to fail on previous code. Never rebuild preview/index.html while reviewers use it: build to side folder and point e2e at it with MQ_APP_FILE — Reason: reviewers need a stable artifact; regressions must be provable.
- Decision: one shared sequence counter numbers requests, documents, invoices, notifications; anything allocating in seeded history shifts seeded ids; payment notes use id pay-<docId> and take no number — Reason: keep seeded ids stable for tests and demos.

<!-- handoff:learnings:end -->
