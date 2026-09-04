# Lovable UI Migration Map & Technical Audit

> **Status:** AUDIT & PLANNING PHASE  
> **Authority:** Hospital AI OS Lovable UI Transplant Master Directive  
> **Target Branch:** `feat/lovable-ui-transplant`  
> **Authoritative Functional Source:** `main` (Hospital AI OS Next.js App Router, React 18, Node/pnpm, backend APIs, RBAC, safety boundaries)  
> **Visual Reference Source:** `Lovable-Frontend/` (Vite/TanStack Start prototype)

---

## 1. Executive Summary & Transplant Strategy

This document establishes the authoritative migration map for surgically transplanting the visual and UX design system from the prototype in `Lovable-Frontend/` into the production frontend at `apps/frontend/`.

The primary mandate is:
> **Upgrade Hospital AI OS's visual experience to Lovable's calm, dense, slate-and-teal clinical aesthetic without modifying, breaking, or compromising any backend contracts, authentication flows, RBAC enforcement, clinical safety invariants, audit logging, or test suites.**

---

## 2. Incompatibility & Conflict Analysis

### 2.1 Framework & Build Incompatibilities
- **Lovable Prototype:** Built on Vite + `@tanstack/react-start` + `@tanstack/react-router` + React 19.
- **Existing Production Application:** Built on Next.js 14.2.3 (App Router) + React 18.3.1 + TypeScript 5.4.5 + Vitest.
- **Decision:** **DO NOT PORT** TanStack Start, TanStack Router, `routeTree.gen.ts`, Vite configs, or Nitro/server start files. All route files must remain Next.js App Router (`app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `not-found.tsx`). React 18 remains the runtime version.

### 2.2 Styling System & Token Conflicts
- **Lovable Prototype:** Uses Tailwind CSS v4 syntax (`@theme inline`, OKLCH color functions, CSS utilities like `clinical-panel`, `num`, `page-enter`).
- **Existing Production Application:** Uses CSS Modules (`*.module.css`) + CSS Custom Properties (`tokens.css`, `globals.css`). It has an automated Vitest contract suite (`src/styles/__tests__/design-tokens.test.ts` with 78 assertions) guaranteeing all `--color-primary-*`, `--color-neutral-*`, `--status-*`, `--space-*`, `--radius-*`, `--shadow-*` tokens exist.
- **Resolution / Transplant:** 
  1. **Preserve existing design token contract:** Do not delete or rename existing tokens in `tokens.css`.
  2. **Harmonize Lovable tokens into `tokens.css`:** Add Lovable semantic variables (`--background`, `--foreground`, `--surface`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--critical`, `--warning`, `--success`, `--info`, `--ai`, `--ai-surface`, `--sidebar`, `--sidebar-*`) mapped cleanly to both Light and Dark themes.
  3. **Provide utility classes:** Implement `.clinicalPanel`, `.num` (tabular numerals with mono font), and `.pageEnter` keyframes in `globals.css` so both CSS Modules and direct class names can achieve the Lovable aesthetic seamlessly.

### 2.3 Mock Data & State Architecture
- **Lovable Prototype:** Imports static synthetic mock records directly from `@/lib/data` (`patients`, `encounters`, `labOrders`, `appointments`, `aiNoteDraft`, etc.).
- **Existing Production Application:** Strictly connects to backend services via `api-client.ts`, `patient-service.ts`, `encounter-service.ts`, `appointment-service.ts`, `diagnostics-service.ts`, `task-service.ts`, and `intelligence.service.ts` with typed contracts from `shared`.
- **Decision:** **NEVER IMPORT `Lovable-Frontend/src/lib/data.ts` INTO PRODUCTION.** Every component must receive data from the real services and hooks.

### 2.4 Authentication & Session Management
- **Lovable Prototype:** Client-only demo login with synthetic credentials and localStorage role simulation.
- **Existing Production Application:** Multi-layered security using HTTP-only refresh cookies, in-memory access tokens, JWT verification, automatic token rotation, and `AuthGuard` route wrapping.
- **Decision:** **AUTHORITATIVE REAL AUTH WINS.** The `/login` page will adopt Lovable's split-screen slate visual layout, but will submit against `AuthService.login()` and use existing session hydration.

### 2.5 RBAC & Role Differentiation
- **Lovable Prototype:** `DemoRoleSwitcher` switches client state among 7 roles.
- **Existing Production Application:** Strict 7-role RBAC (`physician`, `nurse`, `pharmacist`, `lab_technician`, `receptionist`, `hospital_admin`, `security_admin`) enforced on the backend via M5 permissions and in the UI via `hasPermission(user?.role, permission)`.
- **Decision:** The authenticated user's actual `user.role` drives navigation and dashboard presentation. The `DemoRoleSwitcher` is strictly visual/demo UI and will NOT override real authorization tokens.

### 2.6 Clinical Safety & AI Governance Boundaries
- **Lab Critical Values:** Must remain deterministic. No LLM or generative AI will ever be responsible for panic/critical value evaluation (`AI_SAFETY.md §4`).
- **AI Note Generation:** AI drafts remain non-authoritative drafts (`AI_SAFETY.md §1`). They require explicit side-by-side clinician review, mandatory human sign-off, and cryptographic signature before committing.

---

## 3. Comprehensive Migration Map

| Lovable Source | Existing Target | Route | Decision | Risk | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/styles.css` | `src/styles/tokens.css` & `globals.css` | Global | **MERGE** | Low | Integrate Lovable OKLCH semantic tokens, `.clinical-panel`, `.num`, `.page-enter` into `tokens.css` and `globals.css` while preserving all 78 existing design token test assertions. |
| `src/components/layout/AppShell.tsx` | `src/components/layout/AppShell/AppShell.tsx` | Global shell | **ADAPT** | Medium | Upgrade existing AppShell to incorporate Lovable's slate sidebar styling, breadcrumb hierarchy, and sticky header while preserving `AuthGuard`, skipLink, and responsive collapse state. |
| `src/components/navigation/RoleAwareSidebar.tsx` | `src/components/layout/AppSidebar/AppSidebar.tsx` | Shell navigation | **MERGE** | Medium | Adopt Lovable's deep slate styling, active pill indicator, and role badge while retaining existing dynamic RBAC route filtering (`getNavItemsForRole`). |
| `src/components/navigation/RoleAwareHeader.tsx` | `src/components/layout/AppHeader/AppHeader.tsx` | Shell header | **MERGE** | Low | Add quick actions, command menu trigger, user menu, and role title in Lovable's clean header layout. |
| `src/components/navigation/Breadcrumbs.tsx` | `src/components/ui/Breadcrumbs/Breadcrumbs.tsx` | All pages | **ADAPT** | Low | Restyle existing breadcrumb component with Lovable's subtle chevron separators and typography. |
| `src/components/navigation/CommandMenu.tsx` | `src/components/navigation/CommandMenu.tsx` | Global | **ADAPT** | Low | Adapt cmdk keyboard shortcut dialog (`Cmd+K` / `Ctrl+K`) for quick navigation across real routes. |
| `src/components/navigation/UserMenu.tsx` | `src/components/navigation/UserMenu.tsx` | Header | **ADAPT** | Low | Connect to existing `useAuth().logout` and display authenticated `user.firstName`, `user.email`, `user.role`. |
| `src/routes/login.tsx` | `src/app/login/page.tsx` | `/login` | **ADAPT** | Low | Adopt Lovable's split-screen slate brand panel + clean login form, connected to `AuthService.login()` with real error handling. |
| `src/routes/dashboard.tsx` + `src/components/roles/*` | `src/app/dashboard/page.tsx` + `src/components/dashboard/DashboardShell.tsx` | `/dashboard` | **MERGE** | High | Integrate Lovable's role-tailored dashboard views (Physician, Nurse, Pharmacist, Lab Tech, Receptionist, Hospital Admin, Security Admin) into `DashboardShell`, backed by real services (`encounterService`, `diagnosticsService`, `taskService`, `useNotifications`). |
| `src/routes/patients.index.tsx` | `src/app/patients/page.tsx` | `/patients` | **ADAPT** | Medium | Upgrade search bar, filter tabs, and patient table presentation using Lovable's clinical table and acuity badges, backed by `patientService.getPatients()`. |
| `src/routes/patients.new.tsx` | `src/app/patients/new/page.tsx` | `/patients/new` | **ADAPT** | Low | Restyle patient registration form to match Lovable form fields and validation cards, submitting via `patientService.createPatient()`. |
| `src/routes/patients.$id.tsx` | `src/app/patients/[id]/page.tsx` | `/patients/[id]` | **MERGE** | Medium | Enhance patient detail view with Lovable's persistent `PatientHeader`, vitals panel, diagnostics queue, and care timeline, connected to real `patientService`, `appointmentService`, and `encounterService`. |
| `src/routes/appointments.index.tsx` | `src/app/appointments/page.tsx` | `/appointments` | **ADAPT** | Medium | Adapt appointment list/queue with Lovable's date filtering, status badges, and doctor queue styling, powered by `appointmentService.getAppointments()`. |
| `src/routes/appointments.new.tsx` | `src/app/appointments/new/page.tsx` | `/appointments/new` | **ADAPT** | Low | Restyle appointment booking form, submitting via `appointmentService.createAppointment()`. |
| `src/routes/encounters.index.tsx` | `src/app/encounters/page.tsx` | `/encounters` | **ADAPT** | Medium | Restyle encounter list with Lovable's status badges, department filters, and physician labels, connected to `encounterService.getEncounters()`. |
| `src/routes/encounters.$id.tsx` | `src/app/encounters/[id]/page.tsx` + layout | `/encounters/[id]` | **MERGE** | High | Unify encounter workspace with Lovable's tab bar (Overview, Notes, Diagnostics, Discharge) and sticky `PatientHeader`. |
| `src/routes/encounters.$id.notes.tsx` | `src/app/encounters/[id]/notes/page.tsx` | `/encounters/[id]/notes` | **CREATE** | High | Create dedicated notes subroute adapting Lovable's side-by-side AI draft, diff viewer, human review banner, and sign-off modal, wired to `clinicalService` and `aiService`. |
| `src/routes/encounters.$id.labs.tsx` | `src/app/encounters/[id]/labs/page.tsx` | `/encounters/[id]/labs` | **CREATE** | Medium | Create dedicated encounter labs subroute using Lovable's lab result rows, reference ranges, and critical banners, wired to `diagnosticsService`. |
| `src/routes/encounters.$id.discharge.tsx` | `src/app/encounters/[id]/discharge/page.tsx` | `/encounters/[id]/discharge` | **CREATE** | Medium | Create dedicated discharge subroute with discharge summary drafting, fitness checklist, and authorization sign-off, wired to `encounterService.dischargeEncounter()`. |
| `src/routes/lab.index.tsx` | `src/app/lab/page.tsx` + `/diagnostics/page.tsx` | `/lab`, `/diagnostics` | **ADAPT** | Medium | Provide `/lab` route (or redirect/render diagnostic queue) using Lovable's specimen queue, turnaround timers, and critical flags, wired to `diagnosticsService.getLabQueue()`. |
| `src/routes/lab.results.$orderId.tsx` | `src/app/lab/results/[orderId]/page.tsx` + `/diagnostics/[orderId]/result/new` | `/lab/results/[orderId]` | **CREATE / ADAPT** | Medium | Create dedicated lab result entry/verification route matching Lovable's analyte table and reference ranges, wired to `diagnosticsService.enterResult()` and `verifyResult()`. |
| `src/routes/tasks.tsx` | `src/app/tasks/page.tsx` | `/tasks` | **ADAPT** | Medium | Upgrade task queue UI with Lovable's priority badges, role assignment filter, and state transitions, backed by `taskService.listTasks()` and `updateTask()`. |
| `src/routes/notifications.tsx` | `src/app/notifications/page.tsx` | `/notifications` | **CREATE** | Low | Create full-page notification center with priority filtering (Critical, Warning, Info), acknowledgment actions, and deep links, backed by `useNotifications` and `notificationService`. |
| `src/routes/admin.staff.tsx` | `src/app/admin/staff/page.tsx` | `/admin/staff` | **ADAPT** | Low | Enhance staff management table and role assignment UI with Lovable's clean admin styling, wired to `staffService`. |
| `src/routes/admin.departments.tsx` | `src/app/admin/departments/page.tsx` | `/admin/departments` | **CREATE** | Low | Create department management and capacity overview using Lovable's cards and metrics. |
| `src/routes/admin.audit.tsx` | `src/app/admin/audit/page.tsx` | `/admin/audit` | **ADAPT** | Medium | Upgrade security audit log viewer with Lovable's event badges, timestamp formatting, and filtering, wired to existing audit service. |
| `src/routes/403.tsx` | `src/app/403/page.tsx` | `/403` | **CREATE** | Low | Implement clean 403 Forbidden page with Lovable's `PermissionDeniedState` and dashboard back-link. |
| `src/routes/404.tsx` | `src/app/not-found.tsx` + `/404/page.tsx` | `/404` | **ADAPT** | Low | Implement custom 404 page with Lovable's `NotFoundState`. |
| `src/components/ui/*` (shadcn primitives) | `src/components/ui/*` | Component library | **MERGE / ADAPT** | Low | Complement existing UI primitives (`Button`, `Card`, `Badge`, `Table`, `Dialog`, `Drawer`, `Skeleton`) with Lovable enhancements, retaining CSS module compatibility and zero unused bloat. |
| `src/components/states/index.tsx` | `src/components/ui/States/*` | Shared states | **ADAPT** | Low | Transplant Lovable's `MetricSkeleton`, `TableSkeleton`, `EmptyState`, `NetworkErrorState`, `ServerErrorState`, `PermissionDeniedState`, `NotFoundState`, and `SuccessState`. |
| `src/components/ai/*` | `src/components/ai/*` | AI workspace & clinical notes | **MERGE** | Medium | Transplant `AIBadge`, `AIState`, `AIEvidenceDrawer`, `AIDraftPanel`, `AIReviewActions`, `AIChartSearchSuggestions` into existing AI components, ensuring grounding and review requirements are prominent. |
| `src/lib/data.ts` | — | — | **DELETE / DO NOT PORT** | None | Synthetic demo data file. Intentionally omitted from production build. |
| `src/lib/role-context.tsx` (Demo role state) | — | — | **DELETE / DO NOT PORT** | None | Synthetic demo role provider. Real roles come exclusively from `AuthContext` (`user.role`). |
| `src/routeTree.gen.ts`, `server.ts`, `start.ts` | — | — | **DELETE / DO NOT PORT** | None | TanStack Start artifacts. Strictly incompatible and excluded. |

---

## 4. Key Verification Checkpoints

1. **Token Invariant Check:** Run Vitest on `design-tokens.test.ts` to ensure 100% of the 78 design token tests pass.
2. **Component & Shell Stability Check:** Run Vitest on `shellRoutes.test.ts`, `appShellStability.contract.test.ts`, `SidebarItem.sr-label.test.ts`, `NavigationProgressBar.contract.test.ts`.
3. **Route Coverage Audit:** Verify every route in the Page-Route Map compiles, resolves, and renders without runtime error:
   - `/login`, `/dashboard`, `/patients`, `/patients/new`, `/patients/[id]`
   - `/appointments`, `/appointments/new`
   - `/encounters`, `/encounters/[id]`, `/encounters/[id]/notes`, `/encounters/[id]/labs`, `/encounters/[id]/discharge`
   - `/lab`, `/lab/results/[orderId]` (and `/diagnostics`, `/diagnostics/[orderId]`)
   - `/tasks`, `/notifications`
   - `/admin/staff`, `/admin/departments`, `/admin/audit`, `/admin/security`
   - `/403`, `/404`
4. **Mock Data Cleanliness Audit:** Grep search the entire `apps/frontend/src` codebase to prove zero occurrences of `@/lib/data` or `Lovable-Frontend/src/lib/data`.
5. **Role Distinctiveness Audit:** Verify all 7 roles receive distinct, tailored dashboard and navigation experiences powered by real `user.role`.
6. **Full Test Suite & Build Verification:** `pnpm --filter frontend test` and `pnpm --filter frontend build` must complete cleanly with zero errors.
