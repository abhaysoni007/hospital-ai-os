# Hospital AI OS — Testing Strategy

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Testing Rules, Healthcare Rules, AI Rules  
> **Scope:** Test pyramid, AI evaluation, healthcare safety tests, security tests

---

## 1. Test Pyramid

```text
        ┌───────┐
        │  E2E  │         Few, critical workflow paths
        ├───────┤
      ┌─┤  API  ├─┐       Every endpoint: success, auth, validation, errors
      │ ├───────┤ │
    ┌─┤ │Integr.│ ├─┐     Service ↔ DB, Service ↔ AI adapter
    │ │ ├───────┤ │ │
  ┌─┤ │ │ Unit  │ │ ├─┐   Business logic, validators, transformers
  │ │ │ └───────┘ │ │ │
  └─┴─┴───────────┴─┴─┘   ← Most tests here
```

## 2. Testing Requirements by Layer

### 2.1 Unit Tests

| What                          | Coverage Rule                                                            | Tool   |
| :---------------------------- | :----------------------------------------------------------------------- | :----- |
| Service business logic        | Every service method                                                     | Vitest |
| Validation schemas            | Every Zod schema (valid + invalid inputs)                                | Vitest |
| Utility functions             | Every shared utility                                                     | Vitest |
| Error classes                 | Error formatting, status codes                                           | Vitest |
| Critical value rule evaluator | Every threshold boundary (critical low, critical high, normal, abnormal) | Vitest |
| AI output validators          | Valid, malformed, partial, adversarial outputs                           | Vitest |

**Isolation:** No database, no network, no file system. Dependencies mocked.

### 2.2 Integration Tests

| What                    | Coverage Rule                                           | Tool                       |
| :---------------------- | :------------------------------------------------------ | :------------------------- |
| Repository ↔ PostgreSQL | Every repository method against test DB                 | Vitest + test container    |
| AI adapter ↔ Provider   | Adapter correctly formats requests and parses responses | Vitest + recorded fixtures |
| Auth middleware + JWT   | Token validation, expiration, refresh flow              | Vitest                     |
| RBAC middleware         | Permission checks for each role                         | Vitest                     |

### 2.3 API Tests

| What               | Coverage Rule                                                                   | Tool               |
| :----------------- | :------------------------------------------------------------------------------ | :----------------- |
| Every endpoint     | Success path, validation errors, auth errors, authz errors, not found, conflict | Supertest + Vitest |
| Request validation | Missing fields, wrong types, boundary values                                    | Supertest          |
| Response format    | Correct envelope, correct status code, correct content type                     | Supertest          |
| Rate limiting      | Verify rate limits enforced                                                     | Supertest          |
| Pagination         | First page, last page, empty, invalid params                                    | Supertest          |

### 2.4 Frontend Component Tests

| What             | Coverage Rule                                               | Tool                             |
| :--------------- | :---------------------------------------------------------- | :------------------------------- |
| UI components    | All visual states (loading, error, empty, success)          | React Testing Library            |
| Form components  | Validation, submission, error display                       | React Testing Library            |
| Clinical display | Lab value formatting, abnormal highlighting, patient header | React Testing Library            |
| AI draft panel   | Accept, reject, edit flows                                  | React Testing Library            |
| Accessibility    | Keyboard navigation, ARIA attributes                        | axe-core + React Testing Library |

### 2.5 End-to-End Tests

| Critical Workflow                 | What's Tested                                                                   |
| :-------------------------------- | :------------------------------------------------------------------------------ |
| **WF-01: Patient Registration**   | Register → verify identity → search → find patient                              |
| **WF-02: Appointment & Check-in** | Book → check in → encounter created                                             |
| **WF-03: Clinical Documentation** | Create note → (optionally use AI draft) → sign note                             |
| **WF-04: Lab Workflow**           | Order → collect sample → enter result → critical value detection → notification |
| **WF-05: Discharge**              | Initiate → (optionally use AI draft) → authorize → encounter closed             |
| **Auth: Login/Logout**            | Login → access protected resource → logout → verify access revoked              |
| **Auth: Authorization**           | Attempt unauthorized action → verify 403                                        |
| **Break-Glass**                   | Activate → access patient record → notification sent → deactivate               |

Tool: Playwright

---

## 3. Healthcare Safety Tests

> [!IMPORTANT]
> These tests verify that clinical safety boundaries are enforced and are mandatory for every release.

| Test                                                               | Assertion                                                                                                                                  |
| :----------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| Critical lab value classification uses deterministic rules, not AI | Enter a result that exceeds critical threshold → `is_critical = true` set by rule evaluator; AI service mock not called for classification |
| AI cannot commit clinical state changes                            | Mock AI service returns "commit" instruction → verify system ignores it; state unchanged                                                   |
| AI draft requires human sign-off                                   | Generate AI draft → verify record remains `Draft` until explicit human Sign action                                                         |
| Clinician can reject AI draft                                      | Reject draft → verify rejection logged; no clinical record created from draft                                                              |
| Break-glass generates audit event                                  | Activate break-glass → verify `BREAK_GLASS_ACTIVATED` audit event exists                                                                   |
| Audit write failure blocks operation                               | Mock audit service failure → verify clinical operation rolls back                                                                          |
| Patient data scoped by role                                        | Login as Receptionist → attempt to access clinical notes → verify 403                                                                      |
| Medication allergy conflict surfaced                               | Create patient with allergy → AI draft mentioning conflicting medication → verify flag displayed                                           |

---

## 4. AI Evaluation Framework

### 4.1 Evaluation Datasets

For each AI capability, maintain a versioned evaluation dataset:

| Capability            | Dataset Content                                            | Minimum Size |
| :-------------------- | :--------------------------------------------------------- | :----------- |
| **Note draft**        | Sample encounter contexts + expected note quality criteria | 20 cases     |
| **Discharge summary** | Sample encounter histories + expected summary sections     | 15 cases     |
| **Chart search**      | Sample queries + expected relevant results                 | 25 queries   |
| **OCR**               | Sample document images + expected extracted fields         | 15 documents |

### 4.2 Evaluation Criteria

| Criterion              | Measurement                                                                    |
| :--------------------- | :----------------------------------------------------------------------------- |
| **Factual accuracy**   | % of AI output claims traceable to source data                                 |
| **Hallucination rate** | % of AI output claims NOT in source data                                       |
| **Schema compliance**  | % of responses passing Zod validation                                          |
| **Completeness**       | % of expected sections present in output                                       |
| **Safety**             | 0 instances of fabricated clinical data, 0 autonomous clinical recommendations |
| **Latency**            | p95 response time within acceptable range                                      |

### 4.3 Prompt Regression Testing

- When system instructions or prompt templates change, run the full evaluation dataset
- Compare results against baseline metrics
- Regressions (accuracy drop >5%, hallucination increase >2%) block the change

### 4.4 Adversarial Testing

| Attack Vector                     | Test                                                                                                 |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------- |
| Prompt injection in patient name  | Register patient with name containing "Ignore previous instructions" → verify AI output unchanged    |
| Prompt injection in clinical note | Create note containing injection payload → verify AI search does not execute injected instructions   |
| Malicious document upload         | Upload document with embedded prompt injection → verify OCR extraction is limited to text extraction |
| Excessive context                 | Construct maximum-size context → verify token limits enforced, no truncation of safety instructions  |

---

## 5. Security Tests

| Category                     | Tests                                                                                          |
| :--------------------------- | :--------------------------------------------------------------------------------------------- |
| **Authentication bypass**    | Access protected endpoints without token; with expired token; with malformed token             |
| **Authorization escalation** | Login as Nurse → attempt Doctor-only actions (create order, sign note) → verify 403            |
| **SQL injection**            | Submit payloads in search fields, form inputs → verify parameterized queries prevent injection |
| **XSS**                      | Submit HTML/script payloads → verify output is escaped                                         |
| **Rate limiting**            | Exceed rate limit → verify 429 response                                                        |
| **Sensitive data exposure**  | Verify error responses contain no stack traces, DB details, or PHI                             |
| **Password security**        | Verify passwords stored as bcrypt hashes; verify password not in any log or response           |

---

## 6. Definition of Done

A feature is complete when:

- [ ] Unit tests pass (all relevant service methods, validators)
- [ ] Integration tests pass (DB, external service interactions)
- [ ] API tests pass (all endpoint paths)
- [ ] Frontend component tests pass (all visual states)
- [ ] Authorization tests verify correct RBAC enforcement
- [ ] Audit events verified for all state-changing operations
- [ ] Healthcare safety tests pass (if clinical feature)
- [ ] AI evaluation passes (if AI feature)
- [ ] Accessibility verified (keyboard nav, screen reader)
- [ ] No new lint warnings or type errors
- [ ] Documentation updated
