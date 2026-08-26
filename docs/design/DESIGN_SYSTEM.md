# Hospital AI OS — Design System (M13)

## Principles

1. **PRECISION · TRUST · CALM · CONTROL · INTELLIGENCE** — the five qualities every
   surface must communicate. No decorative noise, no "AI startup" aesthetics.
2. **Real data only.** Every number, name, and status on screen comes from a live,
   permission-controlled endpoint. Loading shows skeletons; failure shows truthful
   errors; empty means empty.
3. **Backend-authoritative security.** Frontend RBAC (`utils/rbac.ts`) is UX-only:
   it hides what a role cannot use. The M5 backend matrix remains the boundary.
4. **Status is never color alone.** Every status renders a text label; critical
   states additionally render an icon (see `utils/statusMeta.ts`).
5. **AI is governed clinical assistance**, never a chatbot (see `UI_UX_PRINCIPLES.md`).

## Token architecture

Source of truth: `apps/frontend/src/styles/tokens.css` (synced with Figma variables).

| Layer | Tokens | Notes |
|---|---|---|
| Palette | `--color-primary-*`, `--color-neutral-*` | Deep indigo primary, slate neutrals |
| Semantic surfaces | `--bg-app`, `--bg-surface`, `--bg-subtle`, `--border-subtle/strong`, `--text-primary/secondary/tertiary` | Dark-mode overrides under `[data-theme='dark']` |
| Status | `--status-critical/urgent/stable/pending/ai-*` | Clinical semantics |
| UI status | `--color-success/warning/danger/info-*` (bg/border/main/text) | Non-clinical UI states |
| Typography | `--font-size-display…caption`, `--line-height-*` | Inter via `next/font` wired through `--font-inter` |
| Spacing | `--space-1…20` | 4/8px grid |
| Radius / shadow | `--radius-xs…2xl`, `--shadow-xs…modal` | |
| Motion | `--duration-fast/base/slow`, `--ease-standard/entrance` | All transitions use these; `prefers-reduced-motion` kills them globally |
| Elevation layers | `--z-sticky/drawer/backdrop/modal/toast` | Prevents ad-hoc z-index wars |
| Focus | `--focus-ring-color/offset` | Global `:focus-visible` outline |

## Component conventions

All shared primitives live in `components/ui` and are exported from `ui/index.ts`.

- **PageHeader** — one `h1` per page + optional description/meta/actions. Every top-level
  workspace screen uses it; no bespoke header stacks.
- **Table kit** (`Table, THead, TH, TBody, TR, TD, NumericTD, RowLink, TableSkeleton`) —
  headers always emit `scope="col"`; interactive rows are keyboard-activatable
  (Tab + Enter/Space) with inner-control detection; captions are visually hidden but
  announced.
- **SemanticBadges** — `AppointmentStatusBadge`, `EncounterStatusBadge`,
  `OrderStatusBadge`, `ResultStatusBadge`, `PriorityBadge`, `RecordStatusBadge`.
  They resolve frozen backend enums via `utils/statusMeta.ts`. Never hand-roll a
  status chip again.
- **ConfirmDialog** — accessible alertdialog (focus trap, Escape, focus return) used for
  every irreversible action: cancel appointment, collect sample, sign record, verify
  result, discard AI draft, abandon form edits.
- **MetricCard** — dashboard metrics with tone + optional navigation; retry affordance
  built in (`MetricRetry`).
- **PatientIdentity / StaffIdentity** — canonical identity hierarchy (name → MRN →
  demographics) with compact variant for dense rows.
- **Input / Select / PasswordInput** — unified field system with label association,
  `aria-invalid`, error announcement, helper text, `hideLabel` for toolbar contexts.

## Status semantics (single source of truth)

`utils/statusMeta.ts` maps every frozen enum:

- Appointment: booked→neutral, checked_in→info, in_consult→primary, completed→stable,
  cancelled→pending.
- Encounter lifecycle: registered→pending, active→primary, discharge_initiated→urgent,
  discharged→stable, closed→pending.
- Diagnostic order: ordered→pending, sample_collected→info, in_progress→primary,
  completed→stable, cancelled→pending.
- Result: preliminary→urgent ("verification required"), verified→stable ("locked"),
  critical_flagged→critical.
- Priority: routine→pending, urgent→urgent (+ icon), stat→critical (+ Zap icon + text).
- Unknown values degrade to the raw value with neutral styling — labels are never invented.
