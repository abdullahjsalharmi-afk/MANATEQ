// Replaces the workflow of every service (and the investor actions that hang on its steps) with the
// transcription of the Service Workflows book.
//
//   node scripts/apply-workflows.mjs <dir>        <dir>/wf/<ID>.json and <dir>/actions/<ID>.json for all 50 services
//
// It refuses to write unless all 50 workflows are present and the step total matches the book.
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_STEPS = 588; // Service Workflows book, version 1.1
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/apply-workflows.mjs <dir with wf/ and actions/>');
  process.exit(1);
}
const SRC = path.resolve('data/source');
const guidePath = path.join(SRC, 'guide-services.json');
const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'));

const problems = [];
const changes = [];
let total = 0;
const next = new Map();
for (const service of guide.services) {
  const wfPath = path.join(dir, 'wf', `${service.id}.json`);
  if (!fs.existsSync(wfPath)) {
    problems.push(`${service.id}: no workflow file`);
    continue;
  }
  const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
  const actionsPath = path.join(dir, 'actions', `${service.id}.json`);
  const actions = fs.existsSync(actionsPath) ? JSON.parse(fs.readFileSync(actionsPath, 'utf8')) : null;
  const investorSteps = wf.steps.filter((s) => s.lane === 'inv' && s.kind === 'human').map((s) => s.id);
  if (investorSteps.length && !actions) problems.push(`${service.id}: no actions file but the workflow has investor steps ${investorSteps.join(', ')}`);
  for (const id of investorSteps) if (actions && !actions.some((a) => a.step === id)) problems.push(`${service.id}: investor step ${id} has no action`);
  total += wf.steps.length;
  if (wf.steps.length !== service.wf.steps.length) changes.push(`${service.id}: ${service.wf.steps.length} → ${wf.steps.length} steps`);
  next.set(service.id, { wf, actions: actions ?? [] });
}
if (total !== EXPECTED_STEPS) problems.push(`step total is ${total}; the book has ${EXPECTED_STEPS}`);
if (problems.length) {
  console.error(`NOT APPLIED — ${problems.length} problem(s):\n - ` + problems.join('\n - '));
  process.exit(1);
}

for (const service of guide.services) service.wf = next.get(service.id).wf;
guide.workflowsEdition = 'Service Workflows book, version 1.1 (October 2026)';
fs.writeFileSync(guidePath, JSON.stringify(guide, null, 1));

for (const code of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
  const metaPath = path.join(SRC, 'meta', `${code}.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  for (const service of meta.services) service.actions = next.get(service.id).actions;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
}

console.log(`applied: 50 workflows, ${total} steps`);
console.log(changes.length ? 'step counts changed:\n  ' + changes.join('\n  ') : 'no step counts changed');
