# Role Experiences (M13)

Frontend role surfaces are UX-only mirrors of the frozen M5 matrix
(`apps/backend/src/middleware/rbac/permissions.ts`). Backend authorization remains the
security boundary. The mapping is unit-tested (`utils/__tests__/rbac.test.ts`).

| Role | Navigation | Primary dashboard blocks | Signature workflows |
|---|---|---|---|
| **Physician** | Dashboard · Patients · Encounters · Diagnostics | Critical queue, pending labs, active encounters | Activate encounter, AI SOURCE-GROUNDED drafting, author SOAP/progress notes, sign records (four-eyes on results), order/cancel diagnostics |
| **Nurse** | Dashboard · Patients · Encounters | Active encounters, critical alerts | Record vitals, view clinical notes, encounter activation support |
| **Pharmacist** | Dashboard · Patients | Critical alerts (result-read scope) | Result read via permitted endpoints only; no lab-queue surface is advertised because `diagnostic_order:read` is not granted |
| **Lab Technician** | Dashboard · Patients · Diagnostics | Pending labs, STAT-first work queue | Collect sample (audited provenance), enter results, four-eyes verification |
| **Receptionist** | Dashboard · Patients · Appointments · Encounters | Today's schedule | Register patients, book appointments (guided review flow), check-in → encounter handoff |
| **Hospital Admin** | Dashboard · Patients · Appointments · Encounters | Operational volumes | Read-only operational oversight; admin modules arrive in M20 and are not advertised |
| **Security Admin** | Dashboard | Critical alert visibility (server-derived scope) | Audit/break-glass consoles are M15/M20 scope and intentionally absent |

Rules enforced across all roles:

1. A block renders only if the role holds its permission — no disabled ghosts.
2. Unimplemented capabilities never appear anywhere (nav, dashboards, or stub CTAs).
3. Every role's dashboard shows the critical-result queue because notification scope is
   derived server-side from identity.
