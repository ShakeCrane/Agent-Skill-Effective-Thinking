// Round-5 agent loop — runs ONE (task × arm) episode against the subject model.
// Protocol: fixed system prompt (arm-independent; the protocol is environment, not treatment).
// The arm difference lives ONLY inside the workspace TASK.md (v2 dispatch discipline: the first
// user message is byte-identical across arms); the agent must read TASK.md itself via read_file.
// Records: turns, actions, token usage, api retries, parse degeneration and F16-style
// prose-action turns (declares an action in prose instead of emitting the JSON action).

import { makeTools } from './tools.mjs';

export const SYSTEM_PROTOCOL = `You are an autonomous coding agent working in a file workspace.

Action protocol — EVERY reply you send must be EXACTLY ONE JSON object and nothing else (no markdown fences, no commentary):
{"action":"list_files"}
{"action":"read_file","path":"relative/path"}
{"action":"write_file","path":"relative/path","content":"<FULL file content>"}
{"action":"run_tests"}
{"action":"done","summary":"<one line>"}

After each action you receive "OBSERVATION: ..." as the next user message. Work step by step until the task is complete, then send done.`;

// Byte-identical across arms (copied verbatim from evals/external-v2/conditions.json dispatcher).
export const DISPATCHER = 'Read TASK.md and the repository contents. Complete the task in this workspace. Work autonomously and leave the workspace in its final completed state.';

const PROSE_ACTION_RE = /\b(i will|i'll|now (i )?(write|create|run|fix|update|check|read|verify)|let me|about to)\b|现在|接下来|我将|执行/i;
// Intent narration inside reasoning (no action emitted) — the F16 signature.
const NARRATION_RE = /\b(read|list|write|start|begin|need to|let me|first|check)\b/i;
const TURN_CAP = 30;
const INVALID_STREAK_CAP = 6; // consecutive empty-or-unparseable turns that end a run

// Uniform environment response to a turn with no parseable action (arm-independent).
const EMPTY_NUDGE = 'OBSERVATION: your last reply contained no action. Send exactly ONE JSON action object now (list_files, read_file, write_file, run_tests, or done).';
const INVALID_NUDGE = 'INVALID REPLY: send exactly ONE JSON action object per turn, no other text. Available actions: list_files, read_file, write_file, run_tests, done.';

// Extract the first balanced JSON object from text; tolerates fences and surrounding prose.
export function parseAction(text) {
  if (!text) return null;
  const stripped = text.replace(/```(?:json)?/gi, '');
  const start = stripped.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(stripped.slice(start, i + 1));
          return obj && typeof obj === 'object' && typeof obj.action === 'string' ? obj : null;
        } catch { return null; }
      }
    }
  }
  return null;
}

export async function runEpisode({ client, wsRoot, turnCap = TURN_CAP, wallCapMs = 15 * 60 * 1000 }) {
  const tools = makeTools(wsRoot);
  const messages = [
    { role: 'system', content: SYSTEM_PROTOCOL },
    { role: 'user', content: DISPATCHER },
  ];
  const t0 = Date.now();
  const telemetry = {
    turns: 0, actions: [], parse_fail_turns: 0, empty_turns: 0, f16_narration_turns: 0,
    prose_action_turns: 0, max_consecutive_invalid: 0, status: 'turn_cap', done_summary: '',
  };
  let streak = 0;

  while (telemetry.turns < turnCap && Date.now() - t0 < wallCapMs) {
    let resp;
    try {
      resp = await client.chat(messages);
    } catch (err) {
      telemetry.status = `api_error: ${String(err.message).slice(0, 200)}`;
      break;
    }
    telemetry.turns++;
    messages.push({ role: 'assistant', content: resp.content, reasoning_content: resp.reasoning });

    if (!resp.content.trim()) {
      // Reasoning-style subjects narrate intent without emitting the action — F16 signature.
      telemetry.empty_turns++;
      if (NARRATION_RE.test(resp.reasoning || '')) telemetry.f16_narration_turns++;
      streak++;
      telemetry.max_consecutive_invalid = Math.max(telemetry.max_consecutive_invalid, streak);
      if (streak >= INVALID_STREAK_CAP) { telemetry.status = 'degenerate'; break; }
      messages.push({ role: 'user', content: EMPTY_NUDGE });
      continue;
    }

    const action = parseAction(resp.content);
    if (!action) {
      telemetry.parse_fail_turns++;
      if (PROSE_ACTION_RE.test(resp.content)) telemetry.prose_action_turns++;
      streak++;
      telemetry.max_consecutive_invalid = Math.max(telemetry.max_consecutive_invalid, streak);
      if (streak >= INVALID_STREAK_CAP) { telemetry.status = 'degenerate'; break; }
      messages.push({ role: 'user', content: INVALID_NUDGE });
      continue;
    }
    streak = 0;
    telemetry.actions.push({ turn: telemetry.turns, action: action.action, path: action.path || null });

    if (action.action === 'done') {
      telemetry.status = 'done';
      telemetry.done_summary = String(action.summary || '').slice(0, 300);
      break;
    }
    let observation;
    try {
      const fn = tools[action.action];
      if (!fn) {
        observation = `ERROR: unknown action '${action.action}'. Available: list_files, read_file, write_file, run_tests, done.`;
      } else {
        observation = fn(action);
      }
    } catch (err) {
      observation = `ERROR: ${err.message}`;
    }
    messages.push({ role: 'user', content: `OBSERVATION: ${observation}` });
  }

  telemetry.wall_ms = Date.now() - t0;
  telemetry.tokens = { ...client.stats.tokens }; // NOTE: per-episode client — see runner
  telemetry.api_calls = client.stats.calls;
  telemetry.api_retries = client.stats.retries;
  return { telemetry, transcript: messages };
}
