// Round-5 workspace tools — the action surface the agent can invoke from its JSON protocol.
// Every tool returns a string observation for the next user turn; every call is recorded by the
// agent loop into telemetry. Tools are deliberately minimal: list/read/write/run_tests/done.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const READ_CAP = 16000; // chars per read observation (protects weak-model context)
const OUTPUT_CAP = 8000; // chars of test output returned

export function makeTools(wsRoot) {
  mkdirSync(wsRoot, { recursive: true });

  function abs(p) {
    const clean = String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (clean.includes('..') || /^[a-zA-Z]:/.test(clean)) throw new Error('path must be relative and inside the workspace');
    return join(wsRoot, clean);
  }

  function walk(dir, prefix = '') {
    let out = [];
    for (const name of readdirSync(dir).sort()) {
      if (name === 'node_modules' || name.startsWith('.git')) continue;
      const full = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(full).isDirectory()) out.push(...walk(full, rel));
      else out.push(rel);
    }
    return out;
  }

  const tools = {
    list_files() {
      const files = walk(wsRoot);
      return files.length ? files.join('\n') : '(empty workspace)';
    },
    read_file({ path }) {
      const p = abs(path);
      if (!existsSync(p)) return `ERROR: no such file: ${path}`;
      let s = readFileSync(p, 'utf8');
      if (s.length > READ_CAP) s = s.slice(0, READ_CAP) + `\n...[truncated, ${s.length - READ_CAP} more chars]`;
      return s;
    },
    write_file({ path, content }) {
      if (typeof content !== 'string') return 'ERROR: content must be a string';
      const p = abs(path);
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, content, 'utf8');
      return `wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path}`;
    },
    run_tests() {
      const pkg = join(wsRoot, 'package.json');
      try {
        if (!existsSync(pkg)) return 'ERROR: no package.json in workspace';
        const out = execFileSync('npm', ['test', '--silent'], {
          cwd: wsRoot,
          timeout: 90000,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 4 * 1024 * 1024,
          shell: process.platform === 'win32', // npm needs a shell on Windows
        });
        let s = (out || '').trim();
        if (s.length > OUTPUT_CAP) s = s.slice(0, OUTPUT_CAP) + '\n...[truncated]';
        return `exit 0\n${s || '(no output)'}`;
      } catch (err) {
        let s = `${err.stdout || ''}\n${err.stderr || ''}`.trim();
        if (s.length > OUTPUT_CAP) s = s.slice(0, OUTPUT_CAP) + '\n...[truncated]';
        return `exit ${err.status ?? 'signal'}\n${s || '(no output)'}`;
      }
    },
  };
  return tools;
}

export function relUnder(root, p) {
  return relative(root, p).split(sep).join('/');
}
