# RBAC Audit Matrix

## Role × Resource × Action Matrix

| Resource | Action | Physician | Nurse | Pharmacist | Lab Tech | Receptionist | Hospital Admin | Security Admin |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **patient** | read | YES | YES | YES | YES | YES | YES | NO |
| **patient** | create | NO | NO | NO | NO | YES | NO | NO |
| **patient** | update | NO | NO | NO | NO | YES | NO | NO |
| **patient** | verify_identity | NO | NO | NO | NO | YES | NO | NO |
| **clinical_record** | read | YES | YES | YES | YES | NO | NO | NO |
| **clinical_record** | write | YES | YES | NO | NO | NO | NO | NO |
| **clinical_record** | sign | YES | NO | NO | NO | NO | NO | NO |
| **diagnostic_order** | create | YES | NO | NO | NO | NO | NO | NO |
| **diagnostic_order** | read | YES | YES | NO | YES | NO | NO | NO |
| **diagnostic_order** | update | NO | NO | NO | YES | NO | NO | NO |
| **diagnostic_order** | cancel | YES | NO | NO | NO | NO | NO | NO |
| **diagnostic_result** | read | YES | YES | YES | YES | NO | NO | NO |
| **diagnostic_result** | enter | NO | NO | NO | YES | NO | NO | NO |
| **diagnostic_result** | verify | NO | NO | NO | YES | NO | NO | NO |
| **diagnostic_result** | acknowledge | YES | YES | NO | NO | NO | NO | NO |
| **encounter** | create | YES | NO | NO | NO | YES | NO | NO |
| **encounter** | read | YES | YES | NO | NO | YES | YES | NO |
| **encounter** | update | YES | YES | NO | NO | NO | NO | NO |
| **encounter** | discharge | YES | NO | NO | NO | NO | NO | NO |
| **appointment** | create | NO | NO | NO | NO | YES | NO | NO |
| **appointment** | read | NO | NO | NO | NO | YES | YES | NO |
| **appointment** | update | NO | NO | NO | NO | YES | NO | NO |
| **appointment** | cancel | NO | NO | NO | NO | YES | NO | NO |
| **ai_interaction** | invoke | YES | YES | NO | NO | NO | NO | NO |
| **staff** | manage | NO | NO | NO | NO | NO | YES | NO |
| **audit_event** | read | NO | NO | NO | NO | NO | YES | YES |
| **break_glass** | activate | YES | YES | NO | NO | NO | NO | NO |
| **break_glass** | review | NO | NO | NO | NO | NO | NO | YES |
| **task** | read | YES | YES | YES | YES | YES | YES | YES |
| **task** | update | YES | YES | YES | YES | NO | NO | NO |
| **intelligence** | read | YES | YES | NO | NO | NO | YES | NO |
| **intelligence** | analyze | YES | NO | NO | NO | NO | YES | NO |
| **intelligence** | approve | YES | NO | NO | NO | NO | YES | NO |

## Endpoint Routing Audit Matrix

| Endpoint | Required permission | Allowed roles | Denied roles | Tenant scope | Test result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/patients` | `patient:read` | Physician, Nurse, Pharmacist, Lab Tech, Receptionist, Hospital Admin | Security Admin | Department | PASS |
| `POST /api/v1/patients` | `patient:create` | Receptionist | All others | Department | PASS |
| `PATCH /api/v1/patients/:id` | `patient:update` | Receptionist | All others | Department | PASS |
| `GET /api/v1/clinical-records/:id` | `clinical_record:read` | Physician, Nurse, Pharmacist, Lab Tech | Receptionist, Hospital Admin, Security Admin | Assigned / Break-Glass | PASS |
| `POST /api/v1/diagnostic-orders` | `diagnostic_order:create` | Physician | All others | Encounter | PASS |
| `PATCH /api/v1/diagnostic-orders/:id/cancel` | `diagnostic_order:cancel` | Physician | All others | Order Ownership | PASS |
| `POST /api/v1/encounters/:id/discharge` | `encounter:discharge` | Physician | All others | Assigned | PASS |
| `POST /api/v1/ai/invoke` | `ai_interaction:invoke` | Physician, Nurse | All others | Encounter | PASS |
| `GET /api/v1/audit` | `audit_event:read` | Hospital Admin, Security Admin | All others | System / Dept | PASS |
| `POST /api/v1/break-glass/activate` | `break_glass:activate` | Physician, Nurse | All others | System | PASS |
