// Batch 1a checkers — deterministic port of the IFEval verifiable-instruction semantics for the
// instruction types this batch covers (approximations documented inline where the official
// checker relies on nltk tokenizers; these are single-version, fixed-for-the-round definitions).

const lower = (s) => (s || '').toLowerCase();

const REL = {
  'at least': (n, k) => n >= k,
  'less than': (n, k) => n < k,
  exactly: (n, k) => n === k,
};

const UNICODE_RANGES = {
  th: [[0x0e00, 0x0e7f]],
  ar: [[0x0600, 0x06ff], [0x0750, 0x077f], [0x08a0, 0x08ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]],
  fa: [[0x0600, 0x06ff], [0xfb50, 0xfdff]],
  ur: [[0x0600, 0x06ff], [0x0700, 0x074f]],
  bn: [[0x0980, 0x09ff]],
  hi: [[0x0900, 0x097f]],
  ne: [[0x0900, 0x097f]],
  ja: [[0x3040, 0x30ff], [0x4e00, 0x9fff], [0xff66, 0xff9d]],
  ko: [[0xac00, 0xd7af], [0x1100, 0x11ff]],
  zh: [[0x4e00, 0x9fff], [0x3400, 0x4dbf]],
};

function countWords(s) { return s.split(/\s+/).filter(Boolean).length; }
function countSentences(s) { return s.split(/(?<=[.!?。！？])\s+/).map((x) => x.trim()).filter(Boolean).length; }

export const CHECKERS = {
  'punctuation:no_comma': (v, kw) => !v.includes(','),
  'length_constraints:number_words': (v, kw) => REL[kw.relation](countWords(v), kw.num_words),
  'length_constraints:number_sentences': (v, kw) => REL[kw.relation](countSentences(v), kw.num_sentences),
  'keywords:forbidden_words': (v, kw) => (kw.forbidden_words || []).every((w) => !new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(v)),
  'keywords:existence': (v, kw) => {
    const hit = (kw.keywords || []).map((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(v));
    return kw.relation === 'all' ? hit.every(Boolean) : hit.some(Boolean);
  },
  'keywords:frequency': (v, kw) => {
    const n = (lower(v).match(new RegExp(kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    return REL[kw.relation](n, kw.frequency);
  },
  'keywords:letter_frequency': (v, kw) => {
    const n = (lower(v).split('').filter((c) => c === lower(kw.letter))).length;
    return REL[kw.relation](n, kw.frequency);
  },
  'change_case:english_lowercase': (v) => v === v.toLowerCase(),
  'change_case:english_capital': (v) => v === v.toUpperCase(),
  'detectable_format:number_highlighted_sections': (v, kw) => (v.match(/\*[^*\n]+\*/g) || []).length >= kw.num_highlights,
  'detectable_format:title': (v) => /<<[^>]+>>/.test(v),
  'detectable_format:number_bullet_lists': (v, kw) => (v.match(/^[ \t]*\*[^*]/gm) || []).length === kw.num_bullets,
  'detectable_format:json_format': (v) => { try { JSON.parse(v); return true; } catch { return false; } },
  'detectable_content:number_placeholders': (v, kw) => (v.match(/\[[^\[\]]+\]/g) || []).length === kw.num_placeholders,
  'startend:quotation': (v) => v.trim().startsWith('"') && v.trim().endsWith('"') && v.trim().length >= 2,
  'combination:repeat_prompt': (v, kw) => lower(v.trim()).endsWith(lower((kw.prompt_to_repeat || '').trim())),
  'combination:two_responses': (v) => {
    const parts = v.trim().split(/\*\*\*+/).filter((s) => s.trim());
    return parts.length === 2;
  },
  'language:response_language': (v, kw) => {
    const ranges = UNICODE_RANGES[kw.language];
    if (!ranges) return false; // uncheckable language -> will be excluded at selection
    const letters = [...v].filter((c) => /[\p{L}\p{N}]/u.test(c));
    if (!letters.length) return false;
    const inRange = letters.filter((c) => ranges.some(([a, b]) => c.codePointAt(0) >= a && c.codePointAt(0) <= b));
    return inRange.length / letters.length >= 0.6;
  },
};

// A prompt is selectable iff every one of its instructions is deterministically checkable here.
export function isSelectable(row) {
  return row.instruction_id_list.every((id) => id in CHECKERS);
}

export function scoreRow(row, response) {
  const perInstruction = row.instruction_id_list.map((id) => ({
    id,
    passed: (() => { try { return !!CHECKERS[id](response, row.kwargs[row.instruction_id_list.indexOf(id)] || row.kwargs[id] || {}); } catch { return false; } })(),
  }));
  return { promptPass: perInstruction.every((p) => p.passed), perInstruction };
}
