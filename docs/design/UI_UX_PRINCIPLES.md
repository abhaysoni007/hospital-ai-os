# UI/UX Principles & AI Presentation (M13)

## Clinical usability rules

1. **Attention-first hierarchy.** Critical results dominate the dashboard before any
   metric. The greeting line itself surfaces the unacknowledged critical count.
2. **Progressive disclosure.** Patient charts summarize; encounters expose the working
   set; documentation opens in focused editors. Nothing dumps everything on one page.
3. **Irreversible actions require explicit confirmation** through `ConfirmDialog`
   (cancel appointment, collect sample, sign, verify, discard draft, abandon edits).
4. **Errors are recoverable and specific.** Mapped experiences:
   - `403` → "You don't have permission to perform this action."
   - `404` → "This record is no longer available."
   - `409 VERSION_CONFLICT` → banner with **Load latest version** (records/encounters).
   - `409 SLOT_UNAVAILABLE` → warning: slot was just taken; everything else preserved.
   - `409 INVALID_TRANSITION` / already-done → refresh state, explain what happened.
   - AI outage → "AI assistance is temporarily unavailable. Continue manually."
   Raw backend errors are never shown; failures are never swallowed into fake empties.
5. **Empty states explain what, why, and what to do** — without inventing examples.
6. **Keyboard & screen reader support:** skip-to-content link on every authenticated
   page; all list rows keyboard-activatable; dialogs trap focus, close on Escape, and
   return focus; tables use caption + scoped headers; live regions announce async
   changes; `prefers-reduced-motion` respected globally.

## Responsive strategy

- Desktop (≥1024px): dense clinical workspace; encounter detail uses a sticky context
  rail + work column.
- Tablet (768–1024): two-column layouts collapse to one; dashboard metrics 4→2 columns;
  encounter rail becomes a horizontal pair.
- Mobile (<768): task-focused single column; sidebar becomes an overlay drawer with
  backdrop; tables scroll horizontally inside their card; header swaps the search field
  for a compact icon trigger; metrics stack 2→1 at 600px.
- Verified widths during QA: 1440 / 1280 / 1024 / 768 / 600 / 390.

## AI presentation principles (ADR-018/019 UX)

The AI surface is **clinical assistance embedded in the encounter**, not a chat:

1. Labeled **AI-GENERATED** and **SOURCE-GROUNDED** — provenance is visible up front,
   alongside "Clinician-owned".
2. Draft renders as a clinical document (SOAP headings), not chat bubbles.
3. **Citation chips** under each section link only to authorized sources
   (clinical records → record view; diagnostics → order/result pages).
4. **"Not documented" gaps are a trust feature**: system-computed gap codes render as a
   distinct panel — the system reports what the draft could NOT ground.
5. Actions are explicit: **Use this draft** (binds atomically with `aiDraftId`),
   **Regenerate**, or **Discard with audited reason category**.
6. A provenance footer records model, prompt template, latency, grounding status.
7. There is deliberately **no `/chat` route and no standalone AI app** — intelligence
   appears where decisions happen (encounter → drafting; lab → deterministic critical
   evaluation; dashboard → prioritized attention).
8. Failure is honest: validation-failed drafts are discarded server-side; the panel says
   so and offers retry-or-continue-manually. Nothing auto-signs, ever.
