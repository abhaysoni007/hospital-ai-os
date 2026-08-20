# Hospital AI OS — Frontend Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** UI Rules, Accessibility, Engineering Rules  
> **Scope:** Next.js structure, routing, state management, component architecture, design system, accessibility

---

## 1. Technology Stack

| Component | Technology | Justification |
|:---|:---|:---|
| **Framework** | Next.js 14 (App Router) | SSR/SSG capability, file-based routing, React Server Components |
| **Language** | TypeScript 5.x (strict mode) | Type safety, shared types with backend |
| **Server State** | TanStack Query (React Query) v5 | Caching, background refetch, optimistic updates |
| **Client State** | Zustand | Lightweight, TypeScript-first, minimal boilerplate |
| **Forms** | React Hook Form + Zod | Performant forms, schema-based validation shared with backend |
| **HTTP Client** | Native fetch (wrapped in typed service functions) | No external dependency needed |
| **Styling** | CSS Modules + design tokens | Scoped styles, no runtime CSS overhead |
| **Testing** | Vitest + React Testing Library | Component and integration tests |
| **Accessibility** | WCAG 2.1 AA baseline | Per UI rules |

See **ADR-009** for the full decision record.

---

## 2. Application Structure

```text
src/frontend/
├── app/                            ← Next.js App Router (pages + layouts)
│   ├── layout.tsx                  ← Root layout (auth provider, query provider)
│   ├── page.tsx                    ← Login / redirect
│   ├── (auth)/                     ← Auth-required layout group
│   │   ├── layout.tsx              ← Authenticated shell (sidebar + header)
│   │   ├── dashboard/
│   │   │   └── page.tsx            ← Role-based landing page
│   │   ├── patients/
│   │   │   ├── page.tsx            ← Patient search & list
│   │   │   ├── new/page.tsx        ← Patient registration form
│   │   │   └── [id]/page.tsx       ← Patient detail
│   │   ├── appointments/
│   │   │   ├── page.tsx            ← Appointment queue
│   │   │   └── new/page.tsx        ← Book appointment
│   │   ├── encounters/
│   │   │   ├── page.tsx            ← Active encounters list
│   │   │   └── [id]/
│   │   │       ├── page.tsx        ← Encounter workspace (clinical records, orders)
│   │   │       ├── notes/page.tsx  ← Clinical note entry + AI drafts
│   │   │       ├── labs/page.tsx   ← Lab orders and results
│   │   │       └── discharge/page.tsx ← Discharge workflow
│   │   ├── lab/
│   │   │   ├── page.tsx            ← Lab technician queue
│   │   │   └── results/[orderId]/page.tsx ← Result entry form
│   │   ├── tasks/
│   │   │   └── page.tsx            ← Task inbox
│   │   ├── notifications/
│   │   │   └── page.tsx            ← Notification center
│   │   └── admin/
│   │       ├── staff/page.tsx      ← Staff management
│   │       ├── departments/page.tsx ← Department management
│   │       └── audit/page.tsx      ← Audit log viewer
│   └── login/
│       └── page.tsx                ← Login form
├── components/
│   ├── ui/                         ← Design system primitives (Button, Input, Table, Modal, etc.)
│   ├── clinical/                   ← Clinical display components (VitalsChart, LabResultCard, etc.)
│   ├── forms/                      ← Form components (PatientForm, NoteEditor, etc.)
│   ├── layout/                     ← Shell components (Sidebar, Header, Breadcrumbs)
│   └── ai/                         ← AI components (AIDraftPanel, ChartSearchBar, etc.)
├── hooks/
│   ├── use-auth.ts                 ← Authentication state and actions
│   ├── use-api.ts                  ← Typed API fetch hooks (wraps React Query)
│   └── use-notifications.ts       ← Notification polling/SSE
├── services/
│   ├── api-client.ts               ← Typed HTTP client with auth headers
│   ├── auth-service.ts             ← Login, logout, refresh token logic
│   └── [domain]-service.ts         ← Per-domain API functions
├── stores/
│   ├── auth-store.ts               ← Zustand: current user, token, role
│   └── ui-store.ts                 ← Zustand: sidebar state, modals
├── styles/
│   ├── tokens.css                  ← Design tokens (colors, spacing, typography)
│   ├── globals.css                 ← Reset + global styles
│   └── components/                 ← CSS modules per component
├── types/
│   └── index.ts                    ← Shared frontend types (may import from shared/)
└── utils/
    ├── format.ts                   ← Date, number, clinical value formatters
    └── validation.ts               ← Shared Zod schemas (import from backend shared)
```

---

## 3. Page-Route Map

| Route | Page | Primary User(s) | Workflow |
|:---|:---|:---|:---|
| `/login` | Login form | All | Authentication |
| `/dashboard` | Role-based landing | All | — |
| `/patients` | Patient search & list | Receptionist, Doctor, Nurse | WF-01 |
| `/patients/new` | Registration form | Receptionist | WF-01 |
| `/patients/[id]` | Patient detail/timeline | Doctor, Nurse | WF-01 |
| `/appointments` | Appointment queue | Receptionist, Doctor | WF-02 |
| `/appointments/new` | Book appointment | Receptionist | WF-02 |
| `/encounters` | Active encounters | Doctor, Nurse | WF-02, WF-03 |
| `/encounters/[id]` | Encounter workspace | Doctor, Nurse | WF-03 |
| `/encounters/[id]/notes` | Clinical note editor + AI | Doctor | WF-03 |
| `/encounters/[id]/labs` | Lab orders & results | Doctor | WF-04 |
| `/encounters/[id]/discharge` | Discharge workflow | Doctor | WF-05 |
| `/lab` | Lab technician queue | Lab Technician | WF-04 |
| `/lab/results/[orderId]` | Result entry form | Lab Technician | WF-04 |
| `/tasks` | Task inbox | All clinical | Cross-workflow |
| `/notifications` | Notification center | All | Cross-workflow |
| `/admin/staff` | Staff management | Hospital Admin | Admin |
| `/admin/departments` | Department management | Hospital Admin | Admin |
| `/admin/audit` | Audit log viewer | Security Admin | Admin |

---

## 4. State Management

### 4.1 Server State (TanStack Query)

All API data is managed by React Query. No manual data fetching with `useEffect`.

```typescript
// Example: Patient list
const { data, isLoading, error } = useQuery({
  queryKey: ['patients', { search, page }],
  queryFn: () => patientService.listPatients({ search, page }),
});
```

**Cache invalidation:** Mutations automatically invalidate relevant queries.

### 4.2 Client State (Zustand)

Only UI-local state that does not come from the API:
- Auth state (current user, access token)
- Sidebar open/closed
- Modal visibility
- Form draft state (local autosave)

### 4.3 Authentication State Flow

```text
App Start → Check for refresh token cookie
  → If present: POST /auth/refresh → Store access token in memory → Render auth layout
  → If absent: Redirect to /login

Token expired → TanStack Query interceptor → Attempt refresh
  → If refresh succeeds: Retry original request
  → If refresh fails: Clear auth state → Redirect to /login
```

---

## 5. Clinical Display Safety

Per `.claude/rules/ui.md`:

| Requirement | Implementation |
|:---|:---|
| **Patient identification** | Persistent patient header (name, MRN, DOB, gender) on all encounter pages |
| **Lab abnormal values** | Red highlighting + exclamation icon for abnormal; bold red border for critical |
| **Numerical units** | Always displayed alongside values |
| **Date/time format** | ISO 8601 or locale-appropriate unambiguous format (never "01/02/03") |
| **AI-generated content label** | Blue "AI-Generated Draft" badge on all AI outputs with "Review Required" prompt |
| **Allergies/alerts** | Sticky banner at top of clinical workspace — not dismissible without documentation |

---

## 6. AI Draft Review Interface

The AI draft panel uses a **side-by-side layout**:

```text
┌──────────────────────┬──────────────────────┐
│   AI Draft           │   Your Note          │
│   (read-only)        │   (editable)         │
│                      │                      │
│   [AI-Generated]     │                      │
│   badge              │                      │
│                      │                      │
│   Source citations    │                      │
│   listed below       │                      │
├──────────────────────┴──────────────────────┤
│  [Accept & Edit]  [Reject Draft]  [Start Fresh] │
└──────────────────────────────────────────────┘
```

- "Accept & Edit" copies the draft into the editable panel for the clinician to modify
- "Reject Draft" logs rejection with reason and clears the AI panel
- "Start Fresh" dismisses AI and opens a blank editor
- Signing requires explicit "Sign Note" button (separate from AI acceptance)

---

## 7. Error & Loading States

Every data-fetching component implements:

| State | Display |
|:---|:---|
| **Loading** | Skeleton loaders matching content layout (not spinners for content areas) |
| **Error** | Error card with message + retry button; no stack traces or internal details |
| **Empty** | "No [items] found" with contextual guidance ("Search for a patient to begin") |
| **AI unavailable** | Subtle banner: "AI assistance temporarily unavailable — manual entry available" |
| **Network error** | Toast notification with retry action |

---

## 8. Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|:---|:---|
| **Keyboard navigation** | All interactive elements reachable via Tab; Enter/Space to activate |
| **Focus management** | Focus trapped in modals; focus returned on close; page navigation sets focus |
| **ARIA labels** | All form inputs have associated labels; icons have `aria-label` |
| **Color contrast** | Minimum 4.5:1 for normal text, 3:1 for large text — verified in design tokens |
| **Color not sole indicator** | Abnormal lab values use icon + color, not color alone |
| **Skip navigation** | Skip-to-main-content link for screen readers |
| **Screen reader testing** | Included in QA process |

---

## 9. Design System Strategy

### 9.1 Design Tokens

All visual properties defined as CSS custom properties:

```css
:root {
  /* Colors */
  --color-primary: hsl(215, 70%, 50%);
  --color-danger: hsl(0, 75%, 50%);
  --color-warning: hsl(40, 90%, 50%);
  --color-success: hsl(140, 60%, 40%);
  --color-critical: hsl(0, 90%, 40%);
  
  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
}
```

### 9.2 Component Library

Build internal component library (not a third-party UI kit):
- `Button` (primary, secondary, danger, ghost variants)
- `Input`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`
- `Table` (sortable, paginated)
- `Modal`, `Drawer`, `Dialog` (with focus trap)
- `Badge`, `Tag`, `Alert`
- `Card`, `Panel`
- `Skeleton`, `Spinner`
- `Toast` (notification)

Justification: Healthcare UI requires precise control over clinical display safety (lab value formatting, patient identification, allergy alerts). A generic UI kit would require extensive customization.

---

## 10. Responsive Behavior

| Breakpoint | Target Device | Layout |
|:---|:---|:---|
| ≥ 1280px | Desktop workstation | Full sidebar + main content |
| 768–1279px | Tablet | Collapsible sidebar + main content |
| < 768px | Not a primary target | Basic support; critical info accessible |

Hospital workstation desktops are the primary device. Tablet support for ward rounds. Mobile is not an MVP priority.
