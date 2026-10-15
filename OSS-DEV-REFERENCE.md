# IntelliDesk — Open Source Reference for Developers

**Purpose:** Quick reference for OSS evaluated/cloned for Moglix IntelliDesk.  
**Local clones:** `c:\rushilProcess\open_source_repos\`  
**Prototype:** `PMProcesses/Products/IntelliDesk/` (custom Next.js; patterns from Zammad)

---

## License legend (read before picking a base)

| Symbol | License family | General commercial use |
|--------|----------------|------------------------|
| ✅ | **Permissive** (MIT, Apache-2.0, BSD) | Use, modify, ship in products with minimal obligations (keep copyright notice). |
| ⚠️ | **GPL-2/3** (copyleft) | Fine for **internal/private** deployments. If you **distribute** the software or a derivative, you must share source under the same license. |
| ⚠️ | **AGPL-3.0** (network copyleft) | Same as GPL, plus if users access it **over a network** (typical SaaS), you must offer corresponding source to users. |
| ❌ | **Fair-code / custom** (e.g. n8n SUL) | **Not OSI “open source.”** Often free for **internal business use only**; product/SaaS embedding usually needs a **paid commercial/embed license**. |

> **Legal note:** This table is engineering guidance, not legal advice. Run final license review with Moglix legal before production/SaaS.

---

## Primary stack (IntelliDesk MVP)

| Project | GitHub | License | General use | Role in IntelliDesk | Platforms |
|---------|--------|---------|-------------|---------------------|-----------|
| **Zammad** ⭐ | https://github.com/zammad/zammad | AGPL-3.0 | ⚠️ Internal OK; SaaS requires AGPL compliance (source offer) | **Recommended production base** — email, threading, SLA, Object Manager | Linux (native), **Docker**, K8s, macOS (Docker); Windows via Docker/WSL |
| **GLPI** | https://github.com/glpi-project/glpi | GPL-3.0 | ⚠️ Copyleft | ITIL catalog, approvals, assets (post-MVP) | Linux, Docker |
| **osTicket** | https://github.com/osTicket/osTicket | GPL-2.0 | ⚠️ Copyleft | Email desk reference patterns | Linux (LAMP), Docker |
| **Request Tracker (RT)** | https://github.com/bestpractical/rt | GPL-2.0+ | ⚠️ Copyleft | Enterprise ticket/email reference | Linux (primary) |
| **Snipe-IT** | https://github.com/grokability/snipe-it | AGPL-3.0 | ⚠️ Network copyleft | Asset management (explicitly **out of MVP**) | Linux, Docker |
| **n8n** | https://github.com/n8n-io/n8n | Sustainable Use License | ❌ **Internal automation only** (free); embed/SaaS → commercial license | Planned automations (auto-close, routing) | Docker, Linux, K8s, cloud |
| **Metabase** | https://github.com/metabase/metabase | AGPL-3.0 (+ Enterprise) | ⚠️ AGPL or paid Enterprise | Planned supervisor/BI reporting | Docker, JAR, cloud |
| **Meilisearch** | https://github.com/meilisearch/meilisearch | MIT | ✅ Permissive | Planned search index | Linux, Docker, cloud |
| **MinIO** | https://github.com/minio/minio | AGPL-3.0 | ⚠️ Network copyleft | Planned attachment/object storage | Linux, Docker, K8s |

⭐ = primary recommendation for production fork after pilot.

---

## Other clones in repo (lower priority for IntelliDesk)

| Project | GitHub | License | General use | Relevance | Platforms |
|---------|--------|---------|-------------|-----------|-----------|
| **Kimai** | https://github.com/kimai/kimai | AGPL-3.0 | ⚠️ Network copyleft | Time tracking — not service desk | Linux, Docker |
| **Feng Office** | https://github.com/fengoffice/fengoffice | AGPL-3.0 | ⚠️ Network copyleft | Legacy PM/collab — not evaluated for desk | Linux LAMP |
| **Focalboard** | https://github.com/mattermost/focalboard | MIT (with server build terms) | ✅ Desktop MIT; verify server build license | Kanban/boards — **repo unmaintained** | Windows, macOS, Linux desktop; Docker |
| **Uyuni** | https://github.com/uyuni-project/uyuni | GPL-2.0 | ⚠️ Copyleft | Linux patch management — unrelated to desk | Linux server only |

---

## Current MVP prototype — OSS modules in use

The Windows-native prototype embeds **MIT/permissive npm libraries** (not AGPL desk forks) for missing MVP modules:

| Module (workbook) | OSS library | GitHub | License | File(s) |
| --- | --- | --- | --- | --- |
| MFI-025 MIME parsing | **mailparser** | https://github.com/nodemailer/mailparser | MIT | `src/lib/email-parser.ts` |
| MFI-004/027 Mail transport | **nodemailer** | https://github.com/nodemailer/nodemailer | MIT | `src/lib/mail-transport.ts` |
| MFI-028/031 Notifications | **handlebars** | https://github.com/handlebars-lang/handlebars.js | MIT | `src/lib/notifications.ts` |
| MFI-007 Search | **fuse.js** | https://github.com/krisk/Fuse | MIT | `src/lib/search.ts` |
| MFI-037 Business calendars | **date-fns** + **date-fns-tz** | https://github.com/date-fns/date-fns | MIT | `src/lib/sla.ts`, `src/lib/holidays.ts` |
| MFI-011 Attachments | Local disk (MinIO pattern) | — | — | `src/lib/attachments.ts`, `/api/attachments/[id]` |
| HTML sanitization | **sanitize-html** | https://github.com/apostrophecms/sanitize-html | MIT | `src/lib/email-parser.ts` |
| Form validation (future) | **zod** | https://github.com/colinhacks/zod | MIT | reserved |

**Production satellites** (run as services, not embedded):

| Module | OSS | Role |
| --- | --- | --- |
| Full-text search | **Meilisearch** (MIT) | Replace Fuse.js at scale |
| Object storage | **MinIO** (AGPL) | Replace local `data/attachment-files/` |
| Desk core | **Zammad** (AGPL) | Replace custom Next.js app |
| Reporting | **Metabase** (AGPL) | Supervisor BI beyond CSV |
| Automations | **n8n** (SUL) | Internal workflows only |

Run `npm run test:oss` to verify library integrations.

---

## Current MVP prototype (framework only)

| Project | GitHub | License | Notes |
|---------|--------|---------|-------|
| **Next.js** | https://github.com/vercel/next.js | MIT | UI framework (`next@16.3.4`) |
| **React** | https://github.com/facebook/react | MIT | UI (`react@19.1.2`) |

Runs on **Windows natively** (no Docker) using Node built-in SQLite — for pilot UX validation. Production path remains **Zammad fork** + Meilisearch + MinIO.

---

## Platform quick reference

| Platform | Zammad | GLPI | osTicket | RT | Snipe-IT | n8n | Metabase | Meilisearch | MVP prototype |
|----------|--------|------|----------|-----|----------|-----|----------|-------------|---------------|
| **Linux server** | ✅ Native | ✅ Native | ✅ LAMP | ✅ Native | ✅ Native | ✅ | ✅ | ✅ | ✅ Node |
| **Docker** | ✅ Recommended | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **Kubernetes** | ✅ Helm chart | ✅ | ⚠️ Community | ⚠️ | ✅ | ✅ | ✅ | ✅ | — |
| **Windows native** | ❌ Use Docker/WSL | ❌ | ❌ | ❌ | ⚠️ WSL/Docker | ⚠️ Docker | ⚠️ Docker/JAR | ⚠️ Docker | ✅ **Yes** |
| **macOS** | ⚠️ Docker | ⚠️ Docker | ⚠️ Docker | ⚠️ | ⚠️ Docker | ✅ Docker | ✅ Docker | ✅ Docker | ✅ Node |

---

## Recommended path for Moglix devs

1. **Pilot / UX:** Use IntelliDesk prototype (`npm run dev` on Windows).
2. **Production desk:** Fork **Zammad** (AGPL — plan source-compliance for internal hosted desk).
3. **Automations:** **n8n** for internal workflows only unless legal approves embed license.
4. **Reporting:** Metabase (AGPL) or export to existing BI.
5. **Search / files:** Meilisearch (MIT) + MinIO (AGPL) as satellites.

---

## UI/UX reference (Freshservice screenshots)

Live Mogli Labs screenshots and pattern catalog:  
`../moglilabs.freshservice.com/UI-UX-REFERENCE.md`

## MVP cross-check (workbook)

All 52 **In MVP = YES** items from `moglix_freshservice_index.xlsx` mapped to prototype coverage:  
`MVP-CROSSCHECK.md`

---

*Last updated: Sep 2026 — aligned with PRD-Moglix-IntelliDesk-MVP and local `open_source_repos/` clones.*
