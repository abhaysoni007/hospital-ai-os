# Information Architecture (M13)

## Primary flow

The product is organized around the hospital's real operational spine:

```
Hospital Operations (Dashboard)
    ↓
Patients → Appointments → Check-in
    ↓
Encounters (central clinical workspace)
    ↓
Clinical Records · Diagnostics
    ↓
Critical Results → Notification work queue
    ↓
AI Assistance (inside encounters only)
    ↓
Auditable Clinical Action (edit → accept → sign → immutable record)
```

## Navigation contract

`utils/rbac.ts` `ALL_NAV_ITEMS` is the single navigation source. Rules:

1. **Every destination must be backed by an implemented, permission-gated backend
   capability** (M6–M12.2). Unimplemented modules are never exposed — not even as
   "coming soon" menu entries:
   - Tasks inbox (M14), AI workspace index / chart search (M14/M20),
     staff administration (M20), audit viewer (M20), break-glass review (M15),
     top-level clinical-record index (no such endpoint exists).
2. **Permission gates mirror the page gate and the backend grant.** The lab queue nav
   requires `diagnostic_order:read`, matching both the page guard and
   `GET /diagnostic-orders`. Pharmacists hold result-read only and therefore do not see
   a Lab Queue they cannot open.
3. **No fabricated badges/counts.** The sidebar carries no numeric decorations; the only
   unread indicator is the real notification count in the header.

### Final structure

| Section | Item | Permission | Roles excluded |
|---|---|---|---|
| Operations | Dashboard | authenticated | — |
| Operations | Patients | patient:read | security_admin |
| Operations | Appointments | appointment:read | physician, nurse, pharmacist, lab tech, security_admin |
| Operations | Encounters | encounter:read | pharmacist, security_admin |
| Clinical | Diagnostics | diagnostic_order:read | physician(no? yes has), see matrix |

Exact role surfaces are enumerated and unit-tested in
`apps/frontend/src/utils/__tests__/rbac.test.ts`.

## Routes

Implemented destinations only:

- `/login`
- `/dashboard` (root `/` forwards here)
- `/patients`, `/patients/new`, `/patients/[id]`
- `/appointments`, `/appointments/new` (supports `?patientId=` handoff)
- `/encounters`, `/encounters/[id]`,
  `/encounters/[id]/clinical-records/new?type=…`,
  `/encounters/[id]/clinical-records/[recordId]`,
  `/encounters/[id]/diagnostics/new`
- `/diagnostics`, `/diagnostics/[orderId]`, `/diagnostics/[orderId]/result/new`

Direct-URL access to deferred modules (`/tasks`, `/ai-workspace`, `/admin/*`,
`/clinical-records`) renders an honest placeholder that names the owning milestone and
offers no dead actions.

## Breadcrumbs

Standardized on the operational top level: `Operations / <Area> [/ context]`.
Context tails use human identities (patient name, MRN, test code) — never raw UUIDs.
