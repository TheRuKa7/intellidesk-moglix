# Moglix IntelliDesk — MVP Prototype

End-to-end service desk prototype aligned with [PRD-Moglix-IntelliDesk-MVP.md](../PRDs/PRD-Moglix-IntelliDesk-MVP.md).

## Live demo (GitHub Pages)

**https://theruka7.github.io/intellidesk-moglix/**

Lightweight **static SPA** (`spa/index.html`, localStorage) for click-through demos only.

**Source of truth for the product prototype:** the Next.js + SQLite app below (`npm run start:demo`). Prefer that for QA, screenshots, and PRD sign-off — the Pages SPA is a demoted marketing shell and may lag feature parity.

## Quick start (full prototype)

Requires **Node.js 20.9+**.

```bash
git clone https://github.com/TheRuKa7/intellidesk-moglix.git
cd intellidesk-moglix
npm install
npm run start:demo   # recommended — build + production server
```

Open http://localhost:3020

**Windows:** double-click `Run_IntelliDesk.bat`

### Dev vs demo mode

| Command | When to use |
|---------|-------------|
| `npm run start:demo` | Demos and daily use — fast, stable |
| `npm run dev` | Active development |
| `npm run dev:clean` | Dev mode after port 3020 is stuck |

## Demo accounts

| Email | Role | Landing |
|-------|------|---------|
| `employee@moglix.com` | Requester | `/portal` |
| `agent@moglix.com` | Agent | `/agent` |
| `supervisor@moglix.com` | Supervisor | `/agent?view=open` (Phase 4 reporting hidden) |
| `admin@moglix.com` | Admin | `/admin` |

## Tests

```bash
npm run test        # domain E2E + role separation + smoke
npm run build       # production build
npm run build:pages # static site → out/ (GitHub Pages)
```

## Deploy to GitHub Pages

Pushes to `main` run `.github/workflows/deploy-github-pages.yml` automatically.

Manual build:

```bash
npm run build:pages
# Deploy contents of out/ to GitHub Pages
```

## Architecture

- **Product prototype (source of truth):** Next.js 16 + `node:sqlite` — full PRD flows, admin, watchers, API
- **GitHub Pages (demoted):** `spa/index.html` — client-side marketing demo only; not feature-complete

See [OSS-DEV-REFERENCE.md](./OSS-DEV-REFERENCE.md) for production OSS stack (Zammad fork).

## Data

SQLite file: `data/intellidesk.db` (created on first run). Reset by deleting that file.
