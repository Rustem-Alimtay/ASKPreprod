# Workspace

## Overview

pnpm workspace monorepo with a Unified Portal application — an enterprise operations portal covering 30+ pages including ERP, HR, Customer DB, Projects, Tickets, Equestrian/Stable Master management, Requisitions, Admin, Legal, and more.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 4 (downgraded from Express 5 to match portal code)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod` (v0.7.x for Zod v3 compat)
- **Frontend**: React + Vite + Tailwind CSS v4 + Wouter (routing) + TanStack Query
- **Auth**: Session-based with Passport, `express-session`, `connect-pg-simple`
- **Build**: esbuild (CJS bundle for API server)

## Architecture

### Artifacts

- **portal** (`artifacts/portal/`) — React frontend at `/`, port 25265
- **api-server** (`artifacts/api-server/`) — Express API at `/api`, port 8080
- **mockup-sandbox** (`artifacts/mockup-sandbox/`) — Component preview at `/__mockup`, port 8081

### Schema/DB

- `lib/db/src/schema/portal.ts` — Main portal schema (users, tickets, projects, customers, requisitions, etc.)
- `lib/db/src/schema/sm2.ts` — Stable Master (equestrian) schema (sm2_ prefixed tables)
- `lib/db/src/schema/auth.ts` — Auth schema
- `lib/db/src/schema/index.ts` — Re-exports all schemas

### Vite Aliases (portal)

- `@/` → `artifacts/portal/src/`
- `@shared` → `lib/db/src/schema/portal`
- `@shared/sm2` → `lib/db/src/schema/sm2`
- `@assets` → `attached_assets/`

### API Server Structure

- `artifacts/api-server/src/app.ts` — Main Express app setup, initializes portal auth/routes/seed
- `artifacts/api-server/src/portal-auth.ts` — Session auth with login/logout/forgot-password/reset-password
- `artifacts/api-server/src/portal-routes/` — Route files: admin, customers, tickets, projects, requisitions, equestrian, stable-master, sso, etc.
- `artifacts/api-server/src/storage.ts` — Database storage layer (Drizzle queries)
- `artifacts/api-server/src/storage-sm2.ts` — Stable Master storage layer
- `artifacts/api-server/src/seedServices.ts` — Seeds demo data on startup

### Auth

- Session-based auth using `express-session` + `connect-pg-simple`
- Default admin user created on startup: username `admin`, password set via `ADMIN_DEFAULT_PASSWORD` env var (or auto-generated)
- Roles: `superadmin`, `admin`, `user`
- Cookie: `connect.sid`, httpOnly, sameSite=lax, secure=false (dev)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/portal run dev` — run portal frontend locally

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session encryption secret
- `ADMIN_DEFAULT_PASSWORD` — Optional, sets admin password on first run
- `SYSTEMADMIN_DEFAULT_PASSWORD` — Optional, sets systemadmin password on first run

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
