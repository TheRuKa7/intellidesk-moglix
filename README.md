# Moglix IntelliDesk — MVP Prototype

End-to-end service desk prototype aligned with [PRD-Moglix-IntelliDesk-MVP.md](../PRDs/PRD-Moglix-IntelliDesk-MVP.md).

## Live demo (GitHub Pages)

**https://theruka7.github.io/intellidesk-moglix/**

Browser-based demo with localStorage (portal, agent desk, supervisor reports, mail simulator).  
For the full SQLite + server-actions prototype, run locally (below).

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
| `supervisor@moglix.com` | Supervisor | `/supervisor` |
| `admin@moglix.com` | Admin | `/agent` |

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

- **GitHub Pages:** `spa/index.html` — client-side demo (localStorage)
- **Local / production path:** Next.js 16 + `node:sqlite` — full PRD flows

See [OSS-DEV-REFERENCE.md](./OSS-DEV-REFERENCE.md) for production OSS stack (Zammad fork).

## Data

SQLite file: `data/intellidesk.db` (created on first run). Reset by deleting that file.
