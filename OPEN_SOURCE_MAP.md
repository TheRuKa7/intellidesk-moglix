# Open-source reference map

Local clones live under `c:\rushilProcess\open_source_repos\`.

| OSS project | PRD area | What we reused in prototype |
|-------------|----------|----------------------------|
| **Zammad** | Core desk, email, threading, Object Manager | `INC-` subject threading, public vs internal notes, group/mailbox routing, SLA breach flag, ticket counter continuity |
| **GLPI** | ITIL catalog, approvals, assets (post-MVP) | Status taxonomy with approval-wait states; commerce custom fields placeholder |
| **osTicket / RT** | Email helpdesk patterns | Inbound simulator, outbox instead of SMTP for local dev |
| **Snipe-IT** | Asset association (explicitly out of MVP) | Not implemented — PRD excludes Associate Asset |
| **n8n** (planned) | Automations | Auto-close job endpoint mirrors scheduled automation |
| **Metabase** (planned) | Supervisor reporting | CSV export + aggregate counts |

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
