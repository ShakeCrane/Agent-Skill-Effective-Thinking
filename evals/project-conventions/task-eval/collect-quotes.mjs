// Extracts a bounded excerpt of every run's REPORT.md into one curated file.
//
// The raw run trees are process artifacts and are deleted; the reports are the qualitative evidence
// behind the analysis in 08, and they are cheap to keep in excerpted form. Full reports can be
// regenerated at any time by re-running the harness (see fixtures.mjs), so this is a record of what
// agents actually said, not the only copy of anything irreplaceable.
//
//   node evals/project-conventions/task-eval/collect-quotes.mjs <runsDir> <outFile> [linesPerReport]

import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [runsDir, outFile, n] = process.argv.slice(2);
const LINES = Number(n ?? 22);
if (!runsDir || !outFile) {
  console.error('usage: collect-quotes.mjs <runsDir> <outFile> [linesPerReport]');
  process.exit(2);
}

const dirs = readdirSync(runsDir)
  .filter((d) => statSync(join(runsDir, d)).isDirectory() && /__[a-z]+__r\d+$/.test(d))
  .sort();

const out = [
  '# Verbatim excerpts from the task-level runs',
  '',
  'One bounded excerpt per run, taken from the `REPORT.md` each agent wrote. These are the quotations',
  'the analysis in `research/project-conventions/08-task-level-evaluation.md` relies on. Truncation is',
  'by line count, not by selection, so nothing was edited to fit a conclusion.',
  '',
];

for (const d of dirs) {
  const report = join(runsDir, d, 'REPORT.md');
  out.push(`## ${d}`, '');
  if (!existsSync(report)) {
    out.push('_(no REPORT.md)_', '');
    continue;
  }
  const lines = readFileSync(report, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const excerpt = lines.slice(0, LINES);
  out.push('```markdown', ...excerpt, lines.length > LINES ? `… (${lines.length - LINES} more lines)` : '', '```', '');
}

writeFileSync(outFile, out.join('\n'));
console.log(`wrote ${outFile}: ${dirs.length} reports, ${LINES} lines each`);
