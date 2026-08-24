# Hospital AI OS — Frontend UI/UX Design Specification & Figma Architecture

> **Status:** Production-Grade Healthcare Operating System Design Blueprint  
> **Version:** v1.0 — UI Foundation & Authenticated Shell  
> **Authority:** UI Rules, Clinical Safety UX, WCAG 2.1 AA Accessibility, Phase 3 Architecture  
> **Target Framework:** Next.js 14 (App Router) + TypeScript + React Query + Zustand

---

## 1. Executive Summary & Design System Overview

**Hospital AI OS** is a mission-critical healthcare operations and clinical intelligence platform. It is engineered specifically for the 7 authenticated staff roles:
1. **Physician**
2. **Nurse**
3. **Pharmacist**
4. **Lab Technician**
5. **Receptionist**
6. **Hospital Administrator**
7. **Security Administrator**

The visual language balances **clinical precision, calm operational confidence, high data density without visual crowding, and strict safety ergonomics**.

---

## 2. Figma File Architecture (10 Pages)

The Figma file is organized into 10 dedicated, standardized pages:

```text
📁 Hospital AI OS — Production Design System (Figma)
├── 📄 01 — Cover & Project Metadata
├── 📄 02 — Design System & Tokens
├── 📄 03 — Component Library & Variants
├── 📄 04 — Login & Authentication States
├── 📄 05 — App Shell & Navigation
├── 📄 06 — Operational Dashboards
├── 📄 07 — State System (Loading, Empty, Error, 403, 404, 500)
├── 📄 08 — Responsive Views (Desktop 1440, Tablet 1024, Mobile 390)
├── 📄 09 — Role-Aware Variations (All 7 Roles)
└── 📄 10 — Developer Handoff & Implementation Specs
```

---

## 3. Design Token System (Figma Variables & CSS)

### 3.1 Color Palette & Semantic Tokens
- **Primary (Deep Healthcare Indigo):**
  - Primary 50 (`#EFF6FF`) to Primary 950 (`#0F172A`), Main CTA at Primary 600 (`#1D4ED8`).
- **Neutral Surfaces (Slate Calm):**
  - App Background: `#F8FAFC` (Neutral 50)
  - Card/Panel Surface: `#FFFFFF` (Neutral 0)
  - Sub-surfaces / Table headers: `#F1F5F9` (Neutral 100)
  - Subtle Borders: `#E2E8F0` (Neutral 200)
  - Strong Borders: `#CBD5E1` (Neutral 300)
  - Text Primary: `#0F172A` (Neutral 900)
  - Text Secondary: `#475569` (Neutral 600)
  - Text Muted: `#94A3B8` (Neutral 400)

### 3.2 Clinical Status Semantic Mapping
| Status | Background | Border | Text | Badge Color | Use Cases |
|:---|:---|:---|:---|:---|:---|
| **Critical** | `#FEF2F2` | `#EF4444` (2px) | `#991B1B` | `#DC2626` | Panic lab values, acute emergency alerts |
| **Urgent** | `#FFF7ED` | `#F97316` | `#9A3412` | `#EA580C` | STAT orders, pending immediate triage |
| **Stable / Normal** | `#F0FDF4` | `#86EFAC` | `#166534` | `#16A34A` | Completed tasks, normal lab ranges |
| **Pending / Neutral**| `#F8FAFC` | `#CBD5E1` | `#475569` | `#64748B` | Scheduled appointments, drafts |
| **AI Assisted** | `#F5F3FF` | `#DDD6FE` | `#5B21B6` | `#7C3AED` | AI note drafts, AI search summaries |

---

## 4. Typography Hierarchy (Inter UI Scale)

| Level | Size / Line Height | Weight | Letter Spacing | Purpose |
|:---|:---|:---|:---|:---|
| **Display** | 36px / 44px | 700 (Bold) | -0.02em | Splash / Authentication heroes |
| **H1** | 30px / 38px | 600 (SemiBold)| -0.015em| Main module title |
| **H2** | 24px / 32px | 600 (SemiBold)| -0.01em | Dashboard section headers |
| **H3** | 20px / 28px | 600 (SemiBold)| -0.005em| Card & Modal titles |
| **H4** | 16px / 24px | 600 (SemiBold)| 0 | Widget & Panel headers |
| **Body Large**| 16px / 24px | 400 (Regular) | 0 | Long clinical notes & summaries |
| **Body** | 14px / 20px | 400 (Regular) | 0 | Default table text, form inputs |
| **Body Medium**| 14px / 20px | 500 (Medium) | 0 | Table headers, active list items |
| **Small** | 12px / 16px | 400 / 500 | 0 | Secondary metadata, timestamps |
| **Caption** | 11px / 14px | 400 / 600 | +0.02em| MRN tags, field descriptions |
| **Overline**| 11px / 14px | 600 (SemiBold)| +0.06em| Category labels (UPPERCASE) |

---

## 5. Spacing, Radius & Elevation System

- **Spacing Grid:** Strictly 4px/8px incremental (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`, `64px`).
- **Border Radius:**
  - `4px` (XS): Tooltips, small badges
  - `6px` (SM): Form inputs, dropdown menus
  - `8px` (MD): Buttons, table rows, cards
  - `12px` (LG): Modal dialogs, drawer panels
  - `9999px` (Full): Status pill badges, user avatars
- **Elevation Shadows:**
  - `Shadow XS`: `0px 1px 2px 0px rgba(15, 23, 42, 0.05)` (Default cards)
  - `Shadow SM`: `0px 1px 3px 0px rgba(15, 23, 42, 0.08)` (Active cards, buttons)
  - `Shadow MD`: `0px 4px 6px -1px rgba(15, 23, 42, 0.08)` (Dropdowns, popovers)
  - `Shadow LG`: `0px 10px 15px -3px rgba(15, 23, 42, 0.08)` (Slide-over drawers)
  - `Shadow Modal`: `0px 20px 25px -5px rgba(15, 23, 42, 0.12)` (System modals)

---

## 6. Authenticated Application Shell Specifications

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Top Header (Height: 64px)                                                  │
│ [Logo Icon] Breadcrumb: Dashboard / OPD  [🔍 Global Search Cmd+K] [🔔] [👤]│
├──────────────┬──────────────────────────────────────────────────────────────┤
│ Sidebar      │ Main Content Container (Max-Width: 1440px, Padding: 32px)   │
│ (248px)      │                                                              │
│              │ 1. Operational Greeting & Context Banner                     │
│ Operations   │ 2. KPI Metrics Grid (4-Column)                               │
│ - Dashboard  │ 3. Priority Alert Banner (Critical Lab Value / STAT Action)  │
│ - Patients   │ 4. Two-Column Operational Split:                             │
│ - Encounters │    Left (60%): Today's Schedule & Clinical Queue             │
│              │    Right (40%): My Tasks Widget & AI Workspace Assistant     │
│ Clinical     │                                                              │
│ - Records    │                                                              │
│ - Diagnostics│                                                              │
│              │                                                              │
│ [Collapse ◀] │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 7. Role-Aware Navigation Matrix

The navigation renders strictly based on the authenticated user's permissions:

| Navigation Item | Physician | Nurse | Pharmacist | Lab Tech | Receptionist | Hospital Admin | Security Admin |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Patients** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Appointments**| ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Encounters** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Clinical Records**| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Diagnostics**| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Tasks** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI Workspace**| ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Staff Admin**| ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Audit Log** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Security** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 8. Screen & Frame Specifications

### 8.1 Login Screen (`04 — Login & Authentication`)
- **Desktop Composition (1440 × 1024):**
  - **Left Brand Panel (55% width):** Deep slate-blue gradient, minimalist medical node logo, hero title: *"Intelligent operations for modern care."*, supporting operational statement, subtle status heartbeat animation.
  - **Right Form Card (45% width):** Centered login container (400px width), email input, password input with show/hide toggle, "Remember this device" checkbox, "Sign In" primary button (with loading spinner state), enumeration-resistant error message banner.
- **States:** Default, Focused, Filled, Loading (Disabled button + spinner), Generic Error (*"Sign-in failed. Please verify your credentials and try again."*), Mobile Responsive (Single column stacked).

### 8.2 Mission Control Dashboard (`06 — Dashboard`)
- **Header Greeting:** *"Good morning, Dr. Sarah Chen"* + Subtitle *"Cardiology Department • 8 Active Encounters"*
- **KPI Cards (4-Column Layout):**
  1. `Today's Appointments`: Count **24** | Subtext: **8 remaining** | Icon: `Calendar`
  2. `Active Encounters`: Count **8** | Subtext: **3 in consultation** | Icon: `Stethoscope`
  3. `Pending Tasks`: Count **6** | Subtext: **2 high priority** | Icon: `CheckSquare`
  4. `Critical Alerts`: Count **1** | Subtext: **Action required** | Status: **Critical Alert Red Badge**
- **Priority Attention Section:**
  - Sticky critical alert banner for abnormal potassium level (Patient MRN: `HOS-92841`).
- **Today's Consultation Schedule:**
  - Real-time status tags: `Waiting`, `In Progress`, `Completed`, `Cancelled`.
  - Token numbers, Patient Name, MRN, Age/Gender, Chief Complaint.
- **My Tasks Widget:**
  - Prioritized checklist (`STAT`, `High`, `Medium`, `Routine`) with direct action triggers.
- **AI Workspace Entry Card:**
  - Assistive card: *"Review AI-drafted progress notes, discharge summaries, and chart queries."*
  - Badge: `AI Assisted` | Button: *"Open AI Workspace"*

### 8.3 State System (`07 — States`)
- **403 Access Restricted:** Clean shield icon, title: *"Access Restricted"*, description: *"Your account does not have permission to view this resource."*, primary action: *"Return to Dashboard"*.
- **404 Not Found:** Medical file outline icon, title: *"Page Not Found"*, description: *"The requested clinical or operational resource could not be located."*
- **500 System Error:** Safe operational error banner with correlation ID, no stack trace.
- **Skeletons & Shimmer:** Skeletons for table rows, KPI numbers, and navigation items.

---

## 9. Prototype Interaction Flows (Figma Connections)

1. **Flow 1 (Authentication):** `Login / Default` ➔ Click "Sign In" ➔ `Login / Loading` ➔ Instant Transition ➔ `Dashboard / Physician`
2. **Flow 2 (Global Search Cmd+K):** Press `⌘K` or click search bar ➔ Open Search Overlay with grouped results (`Patients`, `Encounters`, `Orders`) ➔ Select Patient ➔ Open Right-side Patient Preview Drawer.
3. **Flow 3 (Critical Alert Handling):** Click Notification Bell with badge `1` ➔ Notification Popover appears ➔ Click "Review Critical Lab Result" ➔ Navigates directly to Result Verification.
4. **Flow 4 (Role-Switching Verification):** Switch active user in Profile menu ➔ Layout dynamically adjusts navigation items per the RBAC matrix.
5. **Flow 5 (Access Denied):** Direct navigation to restricted route (e.g. Nurse visiting `/admin/staff`) ➔ Renders `403 Access Restricted` screen.

---

## 10. Developer Handoff Guidelines

- **Typography Implementation:** Next.js Google Font `next/font/google` (`Inter`).
- **CSS Architecture:** Scoped CSS modules consuming CSS custom properties in `apps/frontend/src/styles/tokens.css`.
- **Accessibility Verification:**
  - All text meets WCAG AA 4.5:1 minimum contrast.
  - Critical alerts pair color with visual icons and explicit textual labels.
  - Focus outlines are visible on all interactive components (`outline: 2px solid var(--color-primary-500)`).
