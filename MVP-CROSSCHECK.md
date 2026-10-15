# IntelliDesk MVP Cross-Check

**Source workbook:** `moglix_freshservice_index.xlsx` → extracted as `PMProcesses/PRDs/_extracted_freshservice_index.txt`  
**Sheet:** `00_MASTER_INDEX` · column **In MVP = YES**  
**Prototype:** `PMProcesses/Products/IntelliDesk/`  
**Last reviewed:** Sep 2026 (MVP scope lock — Phase 3/4 hidden)

Workbook totals: **Phase 0 = 11 MVP**, **Phase 1 = 41 MVP** → **52 In MVP = YES**.  
Phase 2 = 53 (not MVP). Phase 3 = 7. Phase 4 = 31. **None of Phase 3/4 are In MVP.**

### Legend

| Status | Meaning |
| --- | --- |
| ✅ | Implemented for pilot prototype (E2E / gaps / domain tests) |
| 🟡 | Partial — simulator, seed, or subset; production gap documented |
| 🚫 | Intentionally out of prototype chrome (Phase 2+ / 3 / 4) |

---

## Phase 3 & Phase 4 — must not appear as product features

| Phase | IDs | What | Prototype rule |
| --- | --- | --- | --- |
| **3** | MFI-112–118 | Data migration & cutover | No UI. Ops/runbooks only. |
| **4** | MFI-119–149 | Teams/Slack bots, assets, AI, gamification, projects, multi-tenant, **full reporting (MFI-146/147)**, KB admin, onboarding journeys, etc. | **Hidden from nav.** `/supervisor` redirects to `/agent`. No onboarding / catalog / Solutions teasers. |

**Enforced by:** `npm run test:gaps` (chrome source checks) + `test:roles` + `test:http` redirects.

---

## Phase 0 — Foundations (11)

| ID | Feature | Status | Prototype notes |
| --- | --- | --- | --- |
| MFI-001 | Core data model and schema | ✅ | SQLite: tickets, messages, users, groups, statuses, attachments, audit, outbox + platform extras |
| MFI-002 | Authorisation framework | ✅ | Role guards + privilege catalogue |
| MFI-003 | Background jobs and scheduling | 🟡 | `runAutoCloseJob()` on queue load + API; no durable worker |
| MFI-004 | Mail transport infrastructure | 🟡 | Outbox + Admin inbound test; no real SMTP/IMAP |
| MFI-005 | Notification delivery service | ✅ | Handlebars outbox + in-app notifications |
| MFI-006 | Environments and delivery pipeline | 🟡 | GitHub Actions + Pages |
| MFI-007 | Search infrastructure | 🟡 | Fuse.js on agent queue |
| MFI-008 | Observability and error tracking | ✅ | `platform_events` + Admin Platform events |
| MFI-009 | API surface and conventions | ✅ | `/api/v1` tickets GET/POST/PATCH, agents, notifications, health |
| MFI-010 | Audit log | ✅ | Activity tab |
| MFI-011 | Attachment storage | 🟡 | Local disk; MinIO in production |

---

## Phase 1 — Users, Roles & Access (12)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| MFI-012 | Single sign-on | 🟡 | Demo login + disabled Microsoft button |
| MFI-013 | Session and token management | ✅ | HttpOnly cookies + revoke |
| MFI-014 | Role model | ✅ | 23 seeded roles |
| MFI-015 | Ticket visibility scope | ✅ | Group agents; own tickets for requesters |
| MFI-016 | Agent directory | ✅ | `/admin/agents` (read-only seed) |
| MFI-017 | Agent groups | 🟡 | 3 groups seeded (workbook 128) |
| MFI-018 | Requester directory | ✅ | Auto-create + `/admin/requesters` |
| MFI-019 | Automatic assignment | ✅ | Least-loaded Tech Support |
| MFI-020 | Departments | ✅ | Seeded + admin list |
| MFI-021 | Account/localisation settings | ✅ | `/admin/settings` |
| MFI-022 | Security policy settings | ✅ | `/admin/security` |
| MFI-023 | Privilege catalogue | ✅ | Seeded + admin UI |

---

## Phase 1 — Channels & Email (9)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| MFI-024 | Multi-mailbox inbound | 🟡 | Pilot mailbox + simulator |
| MFI-025 | MIME parsing | 🟡 | mailparser + .eml ingest |
| MFI-026 | Thread matching | ✅ | `[INC-…]` subject token |
| MFI-027 | Outbound mail identity | 🟡 | Outbox / JSON transport |
| MFI-028 | Lifecycle notification templates | ✅ | Handlebars |
| MFI-029 | Sender authentication / spam | ✅ | Domain allowlist + quarantine + release |
| MFI-030 | Auto-reply loop suppression | ✅ | Header / bounce detection |
| MFI-031 | Notification template matrix | ✅ | Admin toggles |
| MFI-032 | In-app notification centre | ✅ | Bell + `/notifications` |

---

## Phase 1 — Ticket Core & SLA (9)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| MFI-033 | Ticket record and identifiers | ✅ | Counter above Freshservice floor |
| MFI-034 | Status model — 25 statuses | ✅ | All seeded |
| MFI-035 | Custom field engine — 187 slots | 🟡 | JSON + commerce fields; not 182 defs |
| MFI-036 | SLA policy engine — 21 policies | 🟡 | Team deadlines + seed policies |
| MFI-037 | Business calendars and holidays | 🟡 | IST + holidays seed |
| MFI-038 | Moglix commerce field set | ✅ | Workbench fields |
| MFI-039 | Classification taxonomy | ✅ | Category / subcategory |
| MFI-040 | SLA breach recording | ✅ | Flag + reason |
| MFI-041 | Resolution note capture | ✅ | Required on resolve |

---

## Phase 1 — Agent Workbench (7)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| MFI-042 | Ticket list view | 🟡 | Filterable + SLA phrase; **no** inline edit / bulk / column chooser |
| MFI-043 | Ticket detail layout | ✅ | Header actions, tabs, sticky properties |
| MFI-044 | Conversation + composer | ✅ | Reply / Forward / Note + canned |
| MFI-045 | Ticket actions | 🟡 | Pick up, watch, close, merge, forward; **no** share / spam-from-ticket / archive UI |
| MFI-046 | Saved views | 🟡 | **6** views (workbook lists 14) |
| MFI-047 | Filter panel | ✅ | Basic + Due-by + saved-views rail |
| MFI-048 | Activity history | ✅ | Audit + outbound log |

---

## Phase 1 — Requester Portal (4)

| ID | Feature | Status | Notes |
| --- | --- | --- | --- |
| MFI-049 | Portal home | 🟡 | Search + shortcuts + recent; **no** announcements / popular services |
| MFI-050 | Raise ticket from portal | 🟡 | **Incident form only** — catalog path is Phase 2 (hidden) |
| MFI-051 | My requests | ✅ | Open/Closed, search, sort, CSV |
| MFI-052 | Requester conversation | ✅ | Reply + reopen |

---

## Still missing or partial vs workbook MVP (honest)

These remain **MVP workbook items** but are incomplete in the prototype — not Phase 3/4:

1. **MFI-012** Entra SSO (button only)
2. **MFI-017 / 024 / 036 / 037** Full group / mailbox / SLA / calendar scale
3. **MFI-035** Full field designer (182 definitions)
4. **MFI-042** Inline edit, bulk select, column chooser
5. **MFI-045** Share, ticket spam, delete/archive surfaces
6. **MFI-046** Remaining saved views (8 of 14)
7. **MFI-049** Announcements + popular items
8. **MFI-050** Service catalog half of raise-ticket

**Phase 2 extras present as algorithms only (not marketed as Phase 2 modules):** merge/tags/locks/canned — useful for pilot, mapped from Zammad/osTicket patterns; full workbook Phase 2 (board, KB, approvals inbox, workflows) stays **out of chrome**.

---

## Explicitly excluded from prototype chrome

| Item | Workbook | Action taken |
| --- | --- | --- |
| Reporting nav + `/supervisor` UI | Phase 4 MFI-146/147 | Redirect → `/agent`; queue KPIs remain |
| Solutions / Service catalog / Onboarding nav | Phase 2 / 4 | Removed from portal |
| Board view stub | Phase 2 MFI-103 | Removed from queue |
| Assets / Tasks / Related tabs | Phase 2 | Never added (Details / Activity / Resolution only) |
| Migration / cutover | Phase 3 | No UI |
| AI, Teams, Slack, assets, projects, gamification | Phase 4 | No UI |

---

## Tests

```bash
npm run test:e2e
npm run test:gaps   # includes Phase 3/4 chrome guards
npm run test:roles
npm run test:http   # after build — redirect checks
```

**Recommended production base:** Zammad — see `OSS-DEV-REFERENCE.md`
