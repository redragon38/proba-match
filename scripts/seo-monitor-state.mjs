import { readFile, writeFile } from 'node:fs/promises';
import { monitorState } from './seo-report.mjs';
const report = JSON.parse(
  await readFile(process.env.SEO_REPORT || 'artifacts/seo-audit.json', 'utf8'),
);
const statePath = process.env.SEO_STATE || 'artifacts/seo-monitor-state.json';
let previous = {};
try {
  previous = JSON.parse(await readFile(statePath, 'utf8'));
} catch {
  /* First observation. */
}
const state = monitorState(report, previous);
await writeFile(statePath, JSON.stringify(state, null, 2));
console.log(
  JSON.stringify(
    state.changed ? { event: 'SEO_STATE_CHANGED', ...state } : { event: 'SEO_STATE_UNCHANGED' },
  ),
);
