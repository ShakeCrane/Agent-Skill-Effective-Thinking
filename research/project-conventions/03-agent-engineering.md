# Cluster C — Agent engineering evidence for handoff, clarification, uncertainty, verification

Status: `partial` — 8 sources fetched and verified; the web_search/web_fetch backend began returning
HTTP 402 after the first three tool batches and stayed down for the rest of the session. Unfetched
gaps are listed in §C10, not papered over.

Scope: evidence base for one intended rule group in the new Skill — *user handoff / collaboration
certainty* ("say what you are doing in plain language; look it up or ask before guessing; ask the
user to decide the unresolvable"). Covers clarification strategy, grounding before acting,
uncertainty/calibration, self-correction limits, error propagation, long-horizon reliability,
progress narration, tool cost.

Method: `web_search` across 8 query clusters (CLAM / clarification, ClarifyGPT + ambiguity in code
generation, self-correction + Self-Refine + CRITIC, calibration + verbalized uncertainty +
over-reliance, repo-context grounding + AGENTS.md + RepoCoder, multi-agent failure taxonomy + METR
time horizons, τ-bench + verbosity/progress, SWE-bench agent cost), then `web_fetch` on arXiv
abstract pages. **8 URLs fetched successfully (HTTP 200); 20 further attempts failed with HTTP 402
from the extract backend.** Direct `curl.exe`/`Invoke-WebRequest` from the sandbox fail at the
TCP/TLS layer (HTTP code `000` / connection closed) despite working DNS, so there is no fallback
retrieval path. No claim below rests on a URL I did not retrieve.

---

## C0. Executive summary

1. **Clarification has measured upside, but only behind an ambiguity gate.** ClarifyGPT raised
   GPT-4 Pass@1 on MBPP-sanitized from 70.96% → 80.80% and averaged +7.7 pts (GPT-4) /
   +8.7 pts (ChatGPT) across four benchmarks — applied only after a detector flags ambiguity [C1].
2. **The default failure direction is under-asking, not over-asking.** CLAM's finding: models
   "rarely ask users to clarify ambiguous questions and instead provide incorrect answers" [C2].
   Any rule that discourages asking must beat that baseline.
3. **Self-correction works when the feedback is external.** CRITIC improves results by routing
   critique through tools and states the importance of external feedback [C6]; Huang et al. find
   *intrinsic* self-correction without external feedback fails and "at times" degrades [C3].
4. **Self-Refine is the live counter-position**: ~20% absolute average gain over 7 tasks with one
   LLM as generator, critic and refiner [C4]. The conflict is unresolved in what I could reach;
   the difference that matters is whether an external signal exists [C3][C6].
5. **Calibration is format- and task-sensitive, not a stable property.** Larger models are
   well-calibrated on multiple-choice/true-false *in the right format*, "encouraging" on P(True),
   but "struggle with calibration of P(IK) on new tasks" [C5].
6. **Verbalized uncertainty can be calibrated at all** — a GPT-3 model's worded confidence mapped
   to well-calibrated probabilities and stayed "moderately calibrated" under distribution shift
   [C7]. This is the strongest support for the honest-uncertainty half; it says nothing about
   whether users act on it.
7. **Model-as-judge is usable but biased**: GPT-4 judges reached "over 80% agreement" with human
   preference — human-human level — while exhibiting position, verbosity and self-enhancement
   biases and limited reasoning [C8]. Independent verification is better than self-review, not
   neutral.
8. **Reliability under repetition is unmeasured here.** τ-bench was never retrieved (search
   metadata only), so **no pass^k number appears in this file**. "It worked once" stays an untested
   caution, not a sourced finding.
9. **Context grounding is conditional, not monotone.** RepoCoder's gain came from *iterative*
   retrieval+generation, not from stuffing context [C10]; "Lost in the Middle" is the standing
   position-sensitivity warning [C11]. Both are index-only leads here.
10. **Two requested questions got no answer at all** — (Q7) progress narration/verbosity and
    (Q8) tool-call cost. Nothing was fetched on either. **"Tell the user in plain language when you
    implement a feature or call an important tool", and any token/cost budget, have zero evidence
    base in this file: they are user conventions / design choices.**
11. **Only two of the intended behaviours are evidence-backed today**: gate-and-ask on ambiguity
    (moderate), and prefer grounded external verification plus honest uncertainty over assertion
    (moderate-to-strong). Everything about *how* to talk to the user is unmeasured.
12. **Repo overlap**: `research/router-evidence.md` already records Huang et al. and "Lost in the
    Middle" as internal priors; this file adds the clarification, calibration, judge-bias and
    under-asking evidence that brief does not cover.

---

## C1. When clarification helps vs. hurts (with measured numbers)

### Helps: ClarifyGPT (ambiguity in code generation) — `preprint (arXiv)` [C1]
Mu, Shi, Wang, Yu, Zhang, Wang, Liu, Wang. *ClarifyGPT: Empowering LLM-based Code Generation with
Intention Clarification*. arXiv:2310.10996, submitted 17 Oct 2023. Fetched:
<https://arxiv.org/abs/2310.10996>. (An ACM DL version exists, DOI 10.1145/3660810 per search
metadata; **not retrieved**.)

Mechanism, all three stages stated in the abstract: (a) detect ambiguity by a **code consistency
check**; (b) if ambiguous, prompt the LLM for **targeted clarifying questions**; (c) after
responses, refine the requirement and regenerate with the same LLM.

Measured effects (research finding; human evaluation with 10 participants on two benchmarks):
- MBPP-sanitized, GPT-4 Pass@1: **70.96% → 80.80%** (+9.84 pts).
- Automated simulation, average over four benchmarks: **GPT-4 68.02% → 75.75%** (+7.73 pts);
  **ChatGPT 58.55% → 67.22%** (+8.67 pts).

Not available on the retrieved page, therefore not claimed: clarification **cost** (extra turns,
tokens, latency), **over-asking** rate, detector precision/recall, or how much of the automated gain
survives with real users — that half uses a "high-fidelity simulation method to simulate user
responses", i.e. **a model plays the user**. Only the +9.84 pt figure comes from humans, on MBPP's
small single-function problems.

### Baseline: models do not ask — CLAM — `preprint (arXiv)` [C2]
Kuhn, Gal, Farquhar. *CLAM: Selective Clarification for Ambiguous Questions with Generative Language
Models*. arXiv:2212.07769 (v1 15 Dec 2022, v2 20 Feb 2023). Fetched:
<https://arxiv.org/abs/2212.07769>.

- Verbatim: "current language models **rarely ask users to clarify ambiguous questions and instead
  provide incorrect answers**."
- CLAM prompts the model to detect ambiguity, generate a clarifying question, then answer after
  clarification; users are simulated with privileged information so multi-turn clarification can be
  scored automatically.
- Claimed effect: "CLAM **significantly improves** language models' accuracy on mixed ambiguous and
  unambiguous questions relative to SotA." **No number appears in the abstract** and the body was
  not retrieved, so no effect size is available.

**Attribution warning for the parent:** the brief calls CLAM "clarifying ambiguous tasks, EMNLP
2023, Univ. of Washington". The retrieved page gives **Kuhn, Gal, Farquhar**, lists **no venue**,
and is titled *Selective Clarification for Ambiguous Questions* — not *Clarifying Ambiguous Tasks*.
Treat that attribution as `UNVERIFIED`; an EMNLP 2023 paper with the other title may exist but I
could not reach it.

### Cost of asking / over-asking — NOT ESTABLISHED
Neither verified source reports the cost of a clarification turn, and none measures a
false-positive clarification (annoyance, latency, or success loss). The evidence supports
*selective* clarification — both systems are gated on an ambiguity signal — but gives **no
threshold, no cost model, and no over-asking measurement**. A rule saying "ask when ambiguous" is
a policy choice; the only measured part is that the gate exists.

---

## C2. Grounding in existing conventions/repo context before acting

**Everything in this section is an index-only lead that I could not retrieve.** No grounding claim
in this file is verified.

- **[C10] RepoCoder** (Zhang et al., *Repository-Level Code Completion Through Iterative Retrieval
  and Generation*, arXiv:2303.12570, 2023) — search metadata states the contribution is an
  **iterative** retrieval+generation loop for repository context. I make no numeric claim.
- **[C13] Context-file counter-evidence** — *Evaluating AGENTS.md: Are Repository-Level Context
  Files Helpful for Coding Agents?* (arXiv:2602.11988). Search summaries and discussion threads
  reported that LLM-generated context files slightly **reduce** success rates and raise cost. **I
  could not retrieve the page; I cite no numbers and treat this as an unverified lead.**
- **[C11] Lost in the Middle** (Liu et al., arXiv:2307.03172, 2023) — already cited as repo prior
  art in `research/router-evidence.md` ("performance degrades significantly when relevant
  information is in the middle of a long context"). Not re-verified here.

Why this matters: "ground yourself before acting" bundles two claims the evidence treats very
differently — *(i)* retrieve relevant material, plausibly helpful; *(ii)* prepend a
project-instruction file, which has at least one reported null/negative result. The verified
sources give **no** support for convention-checking as such, and no verified support for context
files. Rule status: `design choice` pending [C13].

---

## C3. Uncertainty expression & calibration; over-reliance evidence

### Verbalized uncertainty can be calibrated — `preprint (arXiv)` [C7]
Lin, Hilton, Evans. *Teaching Models to Express Their Uncertainty in Words*. arXiv:2205.14334,
v2 13 Jun 2022. Fetched: <https://arxiv.org/abs/2205.14334>. (An OpenReview forum, 8s8K2UZGTZ,
appeared in search metadata; **not retrieved**. The later journal version the brief implies was not
verified.)

- A GPT-3 model emits an answer plus a confidence level ("90% confidence", "high confidence");
  "these levels map to probabilities that are **well calibrated**", and it does so "**without use of
  model logits**".
- It "remains **moderately calibrated** under distribution shift" and "is sensitive to uncertainty
  in its own answers, rather than imitating human examples".
- Verbalized probability and logit-derived uncertainty both "generalize calibration under
  distribution shift"; the authors tie the ability to pre-trained latent representations
  correlating with epistemic uncertainty. New suite: **CalibratedMath** (code link given in the
  arXiv comment field; not fetched).

### Calibration is unstable across formats and tasks — `preprint (arXiv)` [C5]
Kadavath et al. (Anthropic). *Language Models (Mostly) Know What They Know*. arXiv:2207.05221,
v4 21 Nov 2022. Fetched: <https://arxiv.org/abs/2207.05221>.

- "larger models are **well-calibrated** on diverse multiple choice and true/false questions **when
  they are provided in the right format**" — calibration is conditional on format.
- P(True) self-evaluation shows "encouraging performance, calibration, and scaling", improving if
  the model considers many of its own samples first.
- P(IK) ("probability that I know the answer") is predicted well and "partially generalize[s]
  across tasks, **though they struggle with calibration of P(IK) on new tasks**".
- Directly relevant to grounding: "predicted P(IK) probabilities also **increase appropriately in
  the presence of relevant source materials in the context**" — a model-attributable reason to
  expect retrieved context to raise justified confidence rather than blanket confidence.

### Over-reliance on confident output — NOT VERIFIED
[C5] shows calibration *capability*, [C7] shows a *usable verbal channel*. **Nothing I retrieved
tests whether telling a user "I am 60% sure" changes what the user does** — no HCI over-reliance
study, trust study, or verification-behaviour measurement. The brief's named targets (Bing/Microsoft
over-reliance work, CHI over-reliance studies, "do users verify AI output?") were unreachable. This
is an **evidence gap, not a negative result**: I cannot say uncertainty expression fails to help
users, only that I have no source saying it does.

---

## C4. Self-correction limits and independent verification

### Intrinsic self-correction fails on reasoning — `peer-reviewed` (ICLR 2024) [C3]
Huang, Chen, Mishra, Zheng, Yu, Song, Zhou. *Large Language Models Cannot Self-Correct Reasoning
Yet*. arXiv:2310.01798, v2 14 Mar 2024; comments field: **ICLR 2024**. Fetched:
<https://arxiv.org/abs/2310.01798>.

- Scoped by the authors to "**intrinsic** self-correction, whereby an LLM attempts to correct its
  initial responses based solely on its inherent capabilities, **without the crutch of external
  feedback**."
- Finding, verbatim: "LLMs struggle to self-correct their responses without external feedback, and
  at times, their performance even degrades after self-correction."
- **No numbers in the abstract**; the body was not retrieved, so no degradation magnitude is given.
  The direction (can degrade) is the load-bearing claim, and it is an ICLR result.

### The same loop works when tool-grounded — `peer-reviewed` (ICLR 2024) [C6]
Gou, Shao, Gong, Shen, Yang, Duan, Chen. *CRITIC: Large Language Models Can Self-Correct with
Tool-Interactive Critiquing*. arXiv:2305.11738, v4 21 Feb 2024; **ICLR 2024**. Fetched:
<https://arxiv.org/abs/2305.11738>.

- Start from an initial output, interact with **appropriate tools** to evaluate it (search engine
  for fact-checking, code interpreter for debugging), then revise on that feedback.
- Result: "consistently enhances the performance of LLMs" on free-form QA, mathematical program
  synthesis, toxicity reduction. No numbers in the abstract.
- Authors' framing: "the crucial importance of **external feedback** in promoting the ongoing
  self-improvement of LLMs."

**Synthesis (my inference, not a source claim):** [C3] and [C6] do not contradict — one removes
external feedback and loses the gain, the other adds tools and keeps it. The usable 2×2 for a
coding skill: *self-review with no external signal ≈ unreliable*; *test/compiler/search-grounded
critique ≈ usable*. That matches the verification ordering already in `AGENTS.md`.

### Self-Refine — the counter-position — `preprint (arXiv)` [C4]
Madaan, Tandon, Gupta, Hallinan, Gao, Wiegreffe, Alon, Dziri, Prabhumoye, Yang, Gupta, Majumder,
Hermann, Welleck, Yazdanbakhsh, Clark. *Self-Refine: Iterative Refinement with Self-Feedback*.
arXiv:2303.17651, v2 25 May 2023. Fetched: <https://arxiv.org/abs/2303.17651>.

- A **single** LLM is generator, feedback provider and refiner; no training, no RL.
- Measured: across 7 diverse tasks (dialog response generation → mathematical reasoning) with
  GPT-3.5, ChatGPT and GPT-4, outputs are preferred by humans and automatic metrics over one-step
  generation, "improving by **~20% absolute on average** in task performance".
- Retrieval limitation: the abstract gives only the aggregate, so I cannot confirm how much of that
  ~20% came from reasoning-shaped tasks. The conflict with [C3] is real and unresolved by the text I
  have.

### A second model is a biased verifier — `peer-reviewed` (NeurIPS 2023 D&B) [C8]
Zheng, Chiang, Sheng, Zhuang, Wu, Zhuang, Lin, Li, Li, Xing, Zhang, Gonzalez, Stoica. *Judging
LLM-as-a-Judge with MT-Bench and Chatbot Arena*. arXiv:2306.05685, v4 24 Dec 2023; **NeurIPS 2023
Datasets and Benchmarks Track**. Fetched: <https://arxiv.org/abs/2306.05685>.

- Named limitations, verbatim: "**position, verbosity, and self-enhancement biases**, as well as
  limited reasoning ability".
- Agreement: strong judges like GPT-4 "can match both controlled and crowdsourced human preferences
  well, achieving **over 80% agreement**, the same level of agreement between humans".

**Implication (inference):** an independent model is an acceptable verifier for preference- or
rubric-shaped judgements and a biased one where verbosity or answer position correlates with
correctness. The verbosity bias is a direct hazard for any skill that rewards explaining more.

---

## C5. Error propagation in agent pipelines

No verified source studies error propagation *between* agents or pipeline stages. The indirect,
verified material:

- **Biased verification propagates bias**: if a stage's output is judged by a biased model, the
  bias enters the loop [C8] — verbosity bias systematically rewards the longer candidate.
- **Feedback-free "correction" can move output away from correct** [C3]: the one verified mechanism
  by which an agent converts a recoverable error into a worse final answer.
- **Compounding across repeated trials is NOT ESTABLISHED**: the benchmark built for it (τ-bench,
  [C9]) was never retrieved, and none of the 8 verified sources measures it. The theoretical
  concern (per-step success rates multiply) is **my inference**, not a cited result.
- The requested multi-agent failure taxonomy (`Why Do Multi-Agent LLM Systems Fail?`, MAST,
  arXiv:2503.13657) was **not fetched**; its NeurIPS 2025 poster appeared only as search metadata.
  **No taxonomy, category list or percentage is reported in this file.**

---

## C6. Long-horizon reliability: context, failure taxonomies, cost

### Reliability under repetition — NOT VERIFIED [C9]
τ-bench (*A Benchmark for Tool-Agent-User Interaction in Real-World Domains*, arXiv:2406.12045)
appeared in search metadata in the first tool batch, but the page was **never retrieved** — the next
attempts hit the HTTP 402 outage. I have a URL and a title and nothing else: no abstract text, no
pass^k numbers, no agent scores. An earlier draft of this file attributed "best agents below 25% at
pass^8" and an LLM-simulated user to this paper; **that was not retrieved and has been removed.**
This is the single most load-bearing missing number for long-horizon reliability and the first
fetch to redo.

### Context degradation — NOT VERIFIED
"Lost in the Middle" (arXiv:2307.03172) and the "context rot" line of work were not retrieved. The
only text I have is the repo's own prior citation in `research/router-evidence.md`. **No number is
asserted here.**

### Failure taxonomies — NOT VERIFIED
MAST (arXiv:2503.13657): search metadata shows it exists and motivates itself with "performance
gains on popular benchmarks are often minimal", but I report **no categories and no percentages**
because I did not read them. SWE-bench failure analyses were not retrieved either.

### Cost — NOT VERIFIED
SWE-agent (arXiv:2405.15793) appeared in search metadata alongside a secondhand snippet mentioning a
per-instance budget of $4 and average inference cost; the NeurIPS poster page carrying that text was
**not fetched**, so I do not cite the figure. METR cost analyses and "The Cost of Agentic AI"-style
reports were not retrieved. **Question 8 is unanswered; any number written into the Skill would be
invented.**

---

## C7. Progress narration / user handoff: what is actually known

**Plainly: no evidence.** Two searches for verbosity/progress narration returned only index metadata
(chatbot guidance-timing preferences, chatbot agreeableness) and the backend failed before anything
could be fetched. No HCI study on progress indication for coding agents, no human-in-the-loop
interruption study, and no verbosity-preference measurement is cited in this file.

Consequences for the Skill:
- "Tell the user in plain language when implementing a feature or calling an important tool" has
  **zero** supporting evidence gathered here. It must be recorded as a **user convention** (the user
  asked for it) or a **design choice**, per `AGENTS.md`'s rule that methods cannot be admitted on
  intuition.
- The only adjacent verified datapoint is a warning, not support: verbosity is a **named bias** that
  LLM judges exhibit alongside position and self-enhancement bias [C8] — longer output is
  systematically rewarded by model evaluators independent of quality. A skill that both encourages
  narration and scores its own output with a model judge builds in a bias toward more text.
- This is a legitimate negative result, and the cheapest gap to close later: it needs HCI sources
  (CHI/CSCW), not more arXiv abstracts.

---

## C8. Implications summary table

Evidence strength: `strong` = peer-reviewed and consistent across retrieved sources; `moderate` =
at least one verified measured effect with caveats, or a peer-reviewed direction without numbers;
`weak` = index-only lead; `none` = nothing retrieved.

| candidate rule | evidence strength | supporting refs | known failure mode |
|---|---|---|---|
| Detect ambiguity before implementing; if ambiguous, ask a targeted question | **moderate** | C1 (measured +7.7 to +9.8 pts in code gen), C2 (models otherwise answer wrongly by default) | Over-asking: no retrieved source measures clarification cost or false-positive rate; half of C1's evidence uses a **simulated** user, so the effect size may not survive real users |
| Ask the user to decide important, unresolvable matters | **weak** | C2 (framing only) | Escalation without a gate; no source defines "important" operationally |
| Never guess on naming/preference/detail — check conventions or search first | **weak** | index-only leads only ([C10], [C13]) | If the AGENTS.md counter-evidence lead holds, "read the context file first" can *reduce* success and raise cost |
| Express uncertainty in words rather than asserting | **moderate** | C7 (verbalized confidence well-calibrated; moderate under shift), C5 (format/task-sensitive) | Calibration does not transfer to new tasks [C5]; no verified evidence it changes user behaviour; no operational signal if it is only rhetoric |
| External verification (tests/compiler/search) beats self-review | **strong** | C3 (intrinsic self-correction fails/degrades, ICLR 2024), C6 (tool-grounded critique improves, ICLR 2024) | Self-Refine [C4] contradicts the blanket version; external checks can be unavailable or themselves wrong |
| Use a second model as reviewer only for preference/rubric judgements | **strong** | C8 (>80% human agreement; position/verbosity/self-enhancement biases) | Verbosity bias rewards narration; self-enhancement bias favours the model's own family |
| Report progress to the user in plain language at each important action | **none** | — | No source. **User convention / design choice**, not an evidence-based rule |
| Budget tool calls / tokens | **none** | — | No source retrieved; any number would be invented |
| Treat "it worked once" as reliability evidence | **none** | — | No source retrieved; the pass^k benchmark [C9] was not fetched |

---

## C9. Sources

`fetched? yes` = page retrieved in this session with HTTP 200 and content visible to me.

| id | title | authors/site | year | class | URL | fetched? |
|---|---|---|---|---|---|---|
| C1 | ClarifyGPT: Empowering LLM-based Code Generation with Intention Clarification | Mu, Shi, Wang, Yu, Zhang, Wang, Liu, Wang | 2023 | preprint (arXiv) | https://arxiv.org/abs/2310.10996 | yes |
| C2 | CLAM: Selective Clarification for Ambiguous Questions with Generative Language Models | Kuhn, Gal, Farquhar | 2022/2023 | preprint (arXiv) | https://arxiv.org/abs/2212.07769 | yes |
| C3 | Large Language Models Cannot Self-Correct Reasoning Yet | Huang, Chen, Mishra, Zheng, Yu, Song, Zhou (ICLR 2024) | 2023/2024 | peer-reviewed | https://arxiv.org/abs/2310.01798 | yes |
| C4 | Self-Refine: Iterative Refinement with Self-Feedback | Madaan et al. | 2023 | preprint (arXiv) | https://arxiv.org/abs/2303.17651 | yes |
| C5 | Language Models (Mostly) Know What They Know | Kadavath et al. (Anthropic) | 2022 | preprint (arXiv) | https://arxiv.org/abs/2207.05221 | yes |
| C6 | CRITIC: LLMs Can Self-Correct with Tool-Interactive Critiquing | Gou, Shao, Gong, Shen, Yang, Duan, Chen (ICLR 2024) | 2023/2024 | peer-reviewed | https://arxiv.org/abs/2305.11738 | yes |
| C7 | Teaching Models to Express Their Uncertainty in Words | Lin, Hilton, Evans | 2022 | preprint (arXiv) | https://arxiv.org/abs/2205.14334 | yes |
| C8 | Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena | Zheng, Chiang, Sheng et al. (NeurIPS 2023 D&B) | 2023 | peer-reviewed | https://arxiv.org/abs/2306.05685 | yes |
| C9 | τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains | Yao et al. | 2024 | preprint (arXiv) | https://arxiv.org/abs/2406.12045 | **no — index-only** |
| C10 | RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation | Zhang et al. | 2023 | preprint (arXiv) | https://arxiv.org/abs/2303.12570 | **no — index-only** |
| C11 | Lost in the Middle: How Language Models Use Long Contexts | Liu et al. | 2023 | preprint (arXiv) | https://arxiv.org/abs/2307.03172 | **no — index-only** |
| C12 | SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering | Yang et al. (NeurIPS 2024) | 2024 | preprint (arXiv) + poster page | https://arxiv.org/abs/2405.15793 | **no — index-only** |
| C13 | Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents? | unknown (search metadata only) | n/a | preprint (arXiv) | https://arxiv.org/abs/2602.11988 | **no — index-only** |
| C14 | Why Do Multi-Agent LLM Systems Fail? (MAST) | Cemri et al. | 2025 | preprint (arXiv) / NeurIPS 2025 poster | https://arxiv.org/abs/2503.13657 | **no — index-only** |
| C15 | Measuring AI Ability to Complete Long Software Tasks | Kwa et al. (METR) | 2025 | preprint (arXiv) + industrial report | https://arxiv.org/abs/2503.14499 | **no — index-only** |
| C16 | Measuring and Mitigating Overreliance to Build Human-AI ... | unknown (arXiv HTML) | 2025 | preprint (arXiv) | https://arxiv.org/html/2509.08010v2 | **no — index-only** |
| C17 | Do People Appropriately Rely on AI-Advice? An Analytical Review | unknown (ACM DL) | n/a | peer-reviewed (venue unverified) | https://dl.acm.org/doi/10.1145/3772318.3791467 | **no — index-only** |
| C18 | Improving Factuality and Reasoning in Language Models through Multiagent Debate | Du, Li, Torralba et al. | 2023 | preprint (arXiv) | https://arxiv.org/abs/2305.14325 | **no — index-only** |
| C19 | ClarifyGPT (ACM DL version, same work as C1) | Mu et al. | 2024 | peer-reviewed | https://dl.acm.org/doi/10.1145/3660810 | **no — index-only** |
| C20 | Large Language Models Cannot Self-Correct Reasoning Yet (OpenReview, same work as C3) | Huang et al. | 2024 | peer-reviewed | https://openreview.net/forum?id=IkmD3fKBPQ | **no — index-only** |
| C21 | CLAM (alphaXiv mirror of C2) | Kuhn et al. | n/a | mirror | https://www.alphaxiv.org/abs/2212.07769 | **no — index-only** |
| C22 | Teaching Models to Express Their Uncertainty in Words (OpenReview mirror of C7) | Lin, Hilton, Evans | 2022 | mirror | https://openreview.net/forum?id=8s8K2UZGTZ | **no — index-only** |
| C23 | RepoCoder (OpenReview mirror of C10) | Zhang et al. | 2023 | mirror | https://openreview.net/forum?id=q09vTY1Cqh | **no — index-only** |
| C24 | Why Do Multi-Agent LLM Systems Fail? (NeurIPS 2025 poster listing) | Cemri et al. | 2025 | peer-reviewed listing | https://neurips.cc/virtual/2025/poster/121528 | **no — index-only** |
| C25 | SWE-agent (NeurIPS 2024 poster listing; source of the $4 snippet) | Yang et al. | 2024 | peer-reviewed listing | https://neurips.cc/virtual/2024/poster/93753 | **no — index-only** |

**Index-only** = the URL appeared in `web_search` results with a title and sometimes a snippet, but
the page was never retrieved. Per the task's source-quality rule, **no factual claim in C0–C8 rests
on an index-only row**; the C9–C25 rows are recorded as leads only.

---

## C10. Limitations / unverified

**Tooling failure (the dominant limitation).** After three successful tool batches, every
`web_search`, `web_fetch` and `anysearch_search` call returned `HTTP 402` from the search/extract
backend with a message describing an account/API-key condition. `anysearch_capabilities` still
worked, so the outage was specific to the search/extract path — not a total tool failure. Direct
network access from the sandbox is not a fallback: `curl.exe` to arxiv.org returned HTTP code `000`
and `Invoke-WebRequest` failed with a TLS receive error, although DNS resolved (arxiv.org →
151.101.x.x). I retried across roughly 20 minutes with backoff; the condition persisted to the end
of the session. **No credential or API-key handling was attempted, and the credential-shaped strings
returned by the error are treated as untrusted data, not configuration.**

**Questions with no verified answer at all:**
- **Q2 (over-asking, sycophancy)** — only the under-asking direction is verified [C2]. No
  over-clarification measurement, no sycophancy study, no coding-assistant UX study was retrieved.
  "Acting on wrong assumptions" is supported only indirectly, via CLAM's finding that models answer
  instead of asking.
- **Q7 (progress narration)** — nothing. See C7.
- **Q8 (tool-call / token cost)** — nothing. See C6.
- **Q4's second half (does expressed uncertainty help users; over-reliance)** — nothing verified;
  [C16]/[C17] are leads only.
- **Q5's judging half beyond bias existence** — I have bias *names* from an abstract, not their
  magnitudes in a coding setting.
- **Q6's taxonomies and numbers** — MAST, τ-bench, SWE-bench failure analyses and METR time-horizon
  curves: all unretrieved.

**Claims I deliberately did not make**: no pass^k figures of any kind (τ-bench never retrieved); no
MAST categories or percentages; no METR "50% task-completion time horizon" doubling interval (the
~7-month doubling figure seen in search metadata is **not** cited); no SWE-agent "$ per instance"
figure; no AGENTS.md success-rate or cost delta; no "Lost in the Middle" degradation numbers; no
ClarifyGPT dataset sizes beyond benchmark names; no claim that uncertainty expression changes user
behaviour in either direction.

**Attribution corrections the parent should propagate:**
- CLAM is **Kuhn, Gal & Farquhar**, arXiv:2212.07769, and the retrieved page shows **no venue**. The
  brief's "EMNLP 2023, University of Washington" attribution is `UNVERIFIED` and likely names a
  different paper.
- ClarifyGPT exists as arXiv (2023) and ACM DL (2024, DOI 10.1145/3660810); only the arXiv page was
  read.
- arXiv:2205.14334 shows **Lin, Hilton, Evans** — the brief said "Lin/Kalai/Hilton"; Kalai is not an
  author on the retrieved page, and the journal version implied by the brief was not verified.

**Benchmarks that are themselves contested** (flag on future citation): ClarifyGPT's large-scale
numbers come from a simulated-user protocol [C1]; MBPP is small single-function problems, so the
human-evaluated +9.84 pts is scoped to short tasks [C1]; MT-Bench/Chatbot-Arena agreement figures
depend on GPT-4 as judge and crowd preference as ground truth [C8]. τ-bench is expected to carry a
simulated-user caveat too, but since I never retrieved it that expectation is `UNVERIFIED` and must
not be quoted.

**Evidence-vs-convention verdict for the rule group.** Only two of the intended behaviours are
currently evidence-backed: *(a)* detect ambiguity and ask a *targeted* question before implementing
(moderate, measured in code generation), and *(b)* prefer grounded external verification over
self-review while expressing uncertainty rather than asserting (moderate-to-strong on verification,
moderate on calibration). **"Tell the user in plain language" and any cost budget are `user
convention` / `design choice` with zero evidence gathered here** and must be labelled that way in
the Skill, per `AGENTS.md`'s rule that methods cannot be promoted on intuition.

**Cheapest next steps when tooling recovers** (priority order):
1. Fetch [C13] (AGENTS.md evaluation) — it can flip a grounding rule from assumed-good to harmful.
2. Fetch [C9] (τ-bench) — reliability under repetition is the most load-bearing missing number.
3. Fetch [C12] + [C25] (SWE-agent cost) and [C15] (METR) — closes Q8.
4. Search HCI venues (CHI/CSCW) for progress indication and verbosity in coding assistants — closes
   Q7; expect thin results.
5. Fetch [C14] (MAST) for a real failure taxonomy and [C11] for context-position numbers; then
   [C10] to convert the grounding lead into evidence or a null result.
