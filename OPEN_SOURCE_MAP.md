# Open-source reference map

Local clones live under `c:\rushilProcess\open_source_repos\`.

| OSS / license | Module in prototype | Pattern source |
|--------------|---------------------|----------------|
| **handlebars** (MIT) | `notifications.ts`, `canned-responses.ts` | Lifecycle mail + canned/text modules |
| **fuse.js** (MIT) | `search.ts` | Queue search |
| **mailparser** (MIT) | `email-parser.ts` | MIME parse + Auto-Submitted / bounce headers |
| **date-fns** (+ tz) (MIT) | `sla.ts`, lock TTL | Business hours + expire locks |
| **osTicket** (GPL — pattern only) | `ticket-lock.ts`, canned shortcuts | Concurrent edit lock |
| **Zammad / RT** (AGPL/GPL — pattern only) | `ticket-relations.ts` | Merge, related links, tags |

No AGPL/GPL source pasted — algorithms reimplemented under MIT stack.

## Why custom prototype vs Zammad fork?

- Docker/WSL unavailable on target Windows dev machine
- Pilot needs fast UX validation against PRD acceptance criteria
- Zammad remains the recommended production base once infra is ready

## Zammad concepts mapped

| Zammad | IntelliDesk prototype |
|--------|-------------------------|
| Ticket `number` | `tickets.number` / `display_number` (starts 2176596) |
| Article public vs internal | `messages.type` = `public` \| `note` |
| Group + email channel | `groups` + `mailbox` on ticket |
| Object Manager attributes | `custom_fields` JSON + `COMMERCE_FIELDS` |
| SLA calendar | `src/lib/sla.ts` business hours |
| Trigger emails | `mail_outbox` table |

## Running Zammad locally (when Docker works)

```bash
cd Tools/zammad-docker-compose
docker compose up -d
```

See `Tools/Run_Zammad_Local.bat`.
