---
date: 2026-11-25T18:07:13.251Z
project: MANATEQ
session: ec3180b0
schema_version: 1
next_steps_count: 6
has_blockers: true
keywords: manateq one, workflows book, confirmed task, pay sheet, sign sheet, persist store, leaving, renewal, design book, artifact page
headline: Goal: "Manateq One", bilingual (Arabic first, English) high-fidelity prototype of investor-services app for government e
---

# Session Handoff Snapshot
> **Generated:** 11/25/2026, 6:07:13 PM

## 🎯 High-Level Objective
* **Goal:** Goal: "Manateq One", bilingual (Arabic first, English) high-fidelity prototype of investor-services app for government economic-zones company: 50 services with official workflows (588 steps, word for word from workflows book v1.1), journeys, requests, payments, wallet, zones. Core intent: owner wants world-class, minimal, user-friendly, very polished app faithful to official service documents because it stands for a government service; design in Apple-like language with company colours and building renders; delivered as complete, ready files with minimal back-and-forth.

## 📌 Current State & Next Steps
* **Status:** DONE and delivered. Branch claude/wonderful-dirac-lowpbw pushed at commit 15f4dae (previous: b11bc8e); working tree clean; no pull request (none requested). Remaining: nothing owed; waiting for owner feedback. Open optional items only (see nextSteps).
* **Blocker:** none
* **Next Action:** Nothing owed. Wait for owner feedback.

### Remaining Queue
- [ ] If owner supplies the official logo: replace the original app mark, then rebuild single file, design book and Artifact page (scripts/make-artifact-page.mjs) and republish the same Artifact.
- [ ] Publishing guide data or design book, or making the repository private, is the owner's call; until then keep both out of the repository.
- [ ] Cloud environment setup script is unproven until a fresh session starts in it.
- [ ] Optional, low value: fold StepPaySheet into PaySheet (PaySheet already accepts onPay/onFailed); Wallet CSS .controls cleanup; duplication in Choice.tsx; data-build warning about C3 starts with the investor but not marked startable not investigated.
- [ ] After any change: npm run check, update test counts in README.md if tests were added, rebuild the three deliverables, commit and push code only (tracked-files check = 0).

## 🛠️ Modified Files Delta
* src/design/Sheet/useConfirmedTask.ts: new shared hook (exactly-once confirmed task; unmount, open=false and pagehide paths).
* src/design/PaySheet/PaySheet.tsx: uses hook; onPaid receives away flag; private timer removed.
* src/design/SignSheet/SignSheet.tsx: uses hook; onSigned receives away flag; new then prop (note + button label when a task follows).
* src/features/requests/StepPaySheet.tsx: uses hook.
* src/features/requests/ActionRunner.tsx: renewal handling when signature is not last task; toast when left unfinished (here/away).
* src/features/requests/strings.ts: new strings (signedThenPay, signedThenMore, continueToPay, unfinishedHere, unfinishedAway).
* src/app/store.ts: persistStore saves at once while page leaves; visibilitychange flush.
* src/domain/strings.ts: Continue wording unified.
* tests/unit/confirmed-task.test.tsx, tests/unit/runner-leaving.test.tsx, tests/unit/persist.test.ts: new (26 tests).
* tests/e2e/leaving.spec.ts: new (5 tests); tests/e2e/requests.spec.ts: renewal wording.
* README.md, src/design/README.md: new rules documented; test counts 1171 / 87.
* scripts/make-artifact-page.mjs: script that turns single-file build into page format for private Artifact link.

## 🚫 Failed Approaches (DO NOT RETRY)
* Approach: pagehide listener with capture=true to run before store's flush → Result: Chrome ran window listeners in registration order; payment completed after flush, not saved → Lesson: fix in store (save at once while leaving), never rely on capture order at window.
* Approach: judge page-closed behaviour with reload on URL carrying reset=1 → Result: fresh demo world by design, looked like data loss → Lesson: reopen file without reset=1.
* Approach: plain ESM import of playwright from script outside repo → Result: module not found → Lesson: load it with createRequire pointed at the repo's package.json.
* Approach: click sheet Close right after sheet hand-over in e2e → Result: two dialogs present, strict-mode failure → Lesson: wait until one dialog remains; icon buttons have aria-label only, no text.
* Approach: record payment notes through normal notify path → Result: shifted every seeded id, many tests broke → Lesson: notes that must not disturb numbering take a derived id.
* Approach: commit payment at the moment Pay is pressed → Result: rejected in design; store change would re-render or close screens behind sheet mid-processing → Lesson: keep commit at end of processing, add leave path instead.
* Approach: ?reset=1 then only changing hash to reset between test cases → Result: no reload, no reset, stale state → Lesson: use a fresh browser context per case.

## 🔑 Crucial Context & Implicit Rules
* Stack: Vite 8, React 19, TypeScript strict, CSS Modules + design tokens, hash router, small custom store persisted to localStorage key manateq-one:v1 (state version 5), Vitest with happy-dom, Playwright e2e against single-file build preview/index.html. No new dependencies. No linter configured.
* Commands: npm run check = typecheck, unit, build, single-file build, e2e. npm run build:single makes preview/index.html. node scripts/build-data.mjs regenerates data. node scripts/build-design-book.mjs builds design book PDF from preview/index.html. MQ_APP_FILE=<path> points e2e and design book at another build.
* FRESH CLONE CANNOT BUILD: data folders not in repository. Ask owner for the data zip they were given (unzips data/source and src/data/generated at repo root), then npm install.
* URL query for demos/tests (before the hash): reset=1 fresh demo world (only on real page load), demo=tenant|prospect|guest, lang=ar|en, theme=light|dark, text=0..3, speed=N.
* Copy: bilingual, Modern Standard Arabic, no em dashes in user-facing copy, never the words case or ticket.
* Work on branch claude/wonderful-dirac-lowpbw; no pull request unless asked; commit messages carry no model identifiers.
* Talk to owner in Gulf Arabic, concise, saying exactly what is being done; formal documents in Modern Standard Arabic.
* Scratch tooling and review decision lists of this session lived in ephemeral scratch folder, not in repository; durable record of intended behaviour = README sections on engine rules and review, plus regression tests.

## Key Decisions
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

## 🙋 User Contribution (human-authored)
Supplied the three source documents (service guide 4.1, automation and integration manual 4.1, service workflows book 1.1). Rejected the first sketch-style design. Corrected fidelity: workflows must follow the official book. Approved the cloud environment creation prompt. Asked for a link to view the app. No code written or reviewed by the human.

## 🙋 User Decisions (made by the human)
- **Follow the official workflows book exactly**
  - Reason: In the end it is a government site
  - Rejected: The earlier looser reading of the service guide
- **Apple design language, very professional, with renders of buildings**
  - Reason: Did not want sketches
  - Rejected: Hand-sketch visual style
- **Allow an image-generation service for the building renders provided the result is classy**
  - Reason: Wanted a refined look
  - Rejected: None stated
- **Use the company's colours**
  - Reason: Stated preference
  - Rejected: The neutral Apple palette used before
- **Change the Arabic typeface**
  - Reason: Disliked the previous one
  - Rejected: Previous Arabic face (replacement Tajawal was chosen by the assistant)

## Summary
Final stretch of long build. Fixed last confirmed P0: leaving screen (Back, link, page close) while pay or sign sheet said "processing" dropped payment/signature silently. New shared hook carries confirmed task out exactly once; store saves at once while page leaves; renewal signature confirmation now truthful (payment still left). Added 31 regression tests (each fails on previous code). Final build verified: tsc clean, 1171 unit, 87 e2e, workflows 50 services / 588 steps / 0 differences from official book. Independent confirmation (2 reviewers + skeptic, read-only on built file): 12 decisions hold, 0 problems, 0 page errors. Then two wording-only changes (one Arabic word for "Continue"; toast wording depends on where the person is), covered by automated suites only. Deliverables rebuilt and sent: design book PDF (16 pages), single-file app, data zip; private Artifact page republished (version 5). Branch pushed, tree clean.

---
*A short hint surfaces on session start; full context loads only if your next prompt matches a keyword above, or via manual `/handoff-resume`. The same record is available as a sibling `.json` file for external tools.*