# Hyaw CRM Management

Hyaw CRM is a clean, light-mode, multi-tenant SaaS CRM foundation built as an Nx monorepo.

## Stack

- **CRM web:** Next.js + React
- **SaaS admin:** Next.js + React
- **API:** Node.js + Express
- **Database:** PostgreSQL + Prisma
- **Workspace:** Nx + pnpm
- **Authorization:** permission-driven RBMS

## Applications

- `apps/web` — tenant CRM workspace
- `apps/admin` — Hyaw SaaS/platform administration
- `apps/api` — REST API
- `libs/contracts` — shared permission contracts

## Permission-first RBMS

Role names are only labels for categorization. A business can create a role with any name.

Authorization must never depend on role names such as `ADMIN`, `MANAGER`, or `SALES`. Access is granted only through explicit permissions attached to the role.

Examples include `leads.view`, `leads.create`, `leads.assign`, `roles.manage`, and `subscriptions.manage`.

## SaaS tenancy

Every customer business is a `Tenant`. All business-owned CRM data must be scoped by `tenantId`.

The initial foundation contains:

- tenant/business isolation
- users and tenant memberships
- custom roles and permissions
- lead management and scoring
- ownership / assignment
- configurable pipelines and stages
- activity tracking
- subscription records
- separate SaaS admin application
- clean responsive light-mode CRM dashboard

## Local development

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm dev
```

- CRM: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

## Product roadmap

The architecture is ready for the remaining production CRM modules: authentication and sessions, contacts, companies, opportunities, tasks, reminders, lead import/export, custom fields, audit log, reporting, automations, notifications, email/WhatsApp integrations, lead capture forms, billing enforcement, API keys/webhooks and AI assistance.
