// Round-5 API client — one small wrapper around the OpenAI-compatible /chat/completions.
// Quirks handled (observed 2026-10-24 on the commandcode.ai provider):
//   - reasoning-style free models put thinking in `reasoning`/`reasoning_content` and may
//     return EMPTY `content` when the token budget is consumed by reasoning;
//   - `reflection/beam:free` REJECTS a 400 unless prior assistant messages carry
//     `reasoning_content`; other models must NOT receive that unknown field;
//   - transient 429 "upstream unavailable" happens and must be retried with backoff.
// Everything (retries, token usage) is reported back so telemetry can record it honestly.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function loadSecrets() {
  const p = new URL('../../../.scratch/r5/secrets.json', import.meta.url);
  return JSON.parse(readFileSync(p, 'utf8'));
}

const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000];

export class ApiClient {
  constructor({ baseURL, apiKey, model, needsReasoningReplay = false, timeoutMs = 180000 }) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.model = model;
    this.needsReasoningReplay = needsReasoningReplay;
    this.timeoutMs = timeoutMs;
    this.stats = { calls: 0, retries: 0, tokens: { prompt: 0, completion: 0 } };
  }

  buildMessages(messages) {
    // Only replay reasoning when the model demands it; strip otherwise (unknown-parameter 400s).
    return messages.map((m) => {
      if (m.role !== 'assistant') return m;
      if (this.needsReasoningReplay && m.reasoning_content) {
        return { role: 'assistant', content: m.content, reasoning_content: m.reasoning_content };
      }
      return { role: 'assistant', content: m.content };
    });
  }

  async chatOnce(messages, maxTokens) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('api timeout')), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature: 0,
          messages: this.buildMessages(messages),
        }),
      });
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* non-JSON error body */ }
      if (!res.ok) {
        const msg = body?.error?.message || text.slice(0, 300);
        const err = new Error(`HTTP ${res.status}: ${msg}`);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      const c = body.choices?.[0];
      const m = c?.message || {};
      return {
        content: typeof m.content === 'string' ? m.content : '',
        reasoning: m.reasoning || m.reasoning_content || '',
        finishReason: c?.finish_reason || '',
        usage: body.usage || {},
      };
    } finally {
      clearTimeout(timer);
    }
  }

  isRetryable(err) {
    if (err.status === 429 || err.status >= 500) return true;
    if (/timeout|fetch failed|ECONN|network/i.test(err.message)) return true;
    if (err.status === 400 && /temporarily unavailable/i.test(err.message)) return true;
    return false;
  }

  async chat(messages, { maxTokens = 6000 } = {}) {
    let attempt = 0;
    let bump = 0; // budget bumps only for finish=length (reasoning ate the window)
    let lastErr = null;
    while (true) {
      try {
        this.stats.calls++;
        const r = await this.chatOnce(messages, maxTokens + bump * 2000);
        this.stats.tokens.prompt += r.usage.prompt_tokens || 0;
        this.stats.tokens.completion += r.usage.completion_tokens || 0;
        if (!r.content.trim() && r.finishReason === 'length' && bump < 2) { bump++; continue; }
        // Empty content with finish=stop is RETURNED as-is: reasoning-style subjects narrate
        // intent without emitting an action (F16-style); the agent loop nudges uniformly.
        return r;
      } catch (err) {
        lastErr = err;
        if (err.status === 400 && /reasoning_content/i.test(err.message)) {
          // Model demands reasoning replay — flip the flag and retry immediately (no backoff).
          this.needsReasoningReplay = true;
          continue;
        }
        if (!this.isRetryable(err) || attempt >= BACKOFF_MS.length) throw err;
        this.stats.retries++;
        await new Promise((ok) => setTimeout(ok, BACKOFF_MS[attempt]));
        attempt++;
      }
    }
  }
}

// One-time quirk probe: does this model require reasoning_content replay on assistant turns?
// Cheap 2-turn conversation; result cached by the caller.
export async function detectReasoningReplay(baseURL, apiKey, model) {
  const probe = new ApiClient({ baseURL, apiKey, model, timeoutMs: 60000 });
  const t1 = await probe.chat(
    [{ role: 'user', content: 'Reply with exactly: OK' }],
    { maxTokens: 1000 },
  );
  const hist = [
    { role: 'user', content: 'Reply with exactly: OK' },
    { role: 'assistant', content: t1.content, reasoning_content: t1.reasoning },
    { role: 'user', content: 'Now reply with exactly: OK2' },
  ];
  try {
    await probe.chat(hist, { maxTokens: 1000 });
    return { needsReasoningReplay: probe.needsReasoningReplay, ok: true };
  } catch (err) {
    return { needsReasoningReplay: probe.needsReasoningReplay, ok: false, error: err.message };
  }
}

export function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
