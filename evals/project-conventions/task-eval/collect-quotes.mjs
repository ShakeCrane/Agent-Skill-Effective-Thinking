// Extracts a bounded excerpt of every run's REPORT.md into one curated file.
//
// The raw run trees are process artifacts and are deleted; the reports are the qualitative evidence
// behind the analysis in 08, and they are cheap to keep in excerpted form. Full reports can be
// regenerated at any time by re-running the harness (see fixtures.mjs), so this is a record of what
// agents actually said, not the only copy of anything irreplaceable.
//
//   node evals/project-conventions/task-eval/collect-quotes.mjs --out <file> [--lines N] [--append] <runsDir>...
//
// `--append` adds blocks for runs the file does not already contain and leaves everything else alone.
// It exists because runs were added after the first sweep (the trigger arm, then the post-review H3
// re-runs) while the earlier run trees had already been cleaned: the file has to stay a superset of
// every row in results-*.jsonl, and it cannot be regenerated wholesale once a tree is gone.

import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const outFile = flag('--out', null);
const LINES = Number(flag('--lines', 22));
const append = argv.includes('--append');
const runsDirs = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--lines');

if (!outFile || runsDirs.length === 0) {
  console.error('usage: collect-quotes.mjs --out <file> [--lines N] [--append] <runsDir>...');
  process.exit(2);
}

const HEADER = [
  '# Verbatim excerpts from the task-level runs',
  '',
  'One bounded excerpt per run, taken from the `REPORT.md` each agent wrote. These are the quotations',
  'the analysis in `research/project-conventions/08-task-level-evaluation.md` relies on. Truncation is',
  'by line count, not by selection, so nothing was edited to fit a conclusion.',
  '',
];

const existing = append && existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
const already = new Set([...existing.matchAll(/^## (.+)$/gm)].map((m) => m[1]));

const runDirs = [];
for (const dir of runsDirs) {
  for (const d of readdirSync(dir)) {
    if (statSync(join(dir, d)).isDirectory() && /__[a-z]+__r\d+$/.test(d)) runDirs.push([dir, d]);
  }
}
runDirs.sort((a, b) => a[1].localeCompare(b[1]));

const blocks = [];
for (const [dir, d] of runDirs) {
  if (already.has(d)) continue;
  const report = join(dir, d, 'REPORT.md');
  blocks.push(`## ${d}`, '');
  if (!existsSync(report)) {
    blocks.push('_(no REPORT.md)_', '');
    continue;
  }
  const lines = readFileSync(report, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const excerpt = lines.slice(0, LINES);
  blocks.push('```markdown', ...excerpt, lines.length > LINES ? `… (${lines.length - LINES} more lines)` : '', '```', '');
}

const added = runDirs.filter(([, d]) => !already.has(d)).length;
const body = existing ? `${existing.replace(/\s*$/, '')}\n\n${blocks.join('\n')}` : [...HEADER, ...blocks].join('\n');
writeFileSync(outFile, body);
console.log(
  `${append && existing ? 'appended' : 'wrote'} ${outFile}: ${added} new report(s), ${LINES} lines each` +
    (append ? ` (${already.size} already present)` : ''),
);
