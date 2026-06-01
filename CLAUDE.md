# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

mdocs is a Markdown knowledge base for small teams — TypeScript full-stack, Express backend, Vite + React frontend, SQLite for metadata, Markdown files on disk as primary storage. Visitor-based identity (no accounts).

## Commands

```bash
pnpm install
pnpm dev              # runs dev:server (port 4000) + dev:web (port 5173, proxies /api) concurrently
pnpm dev:server       # tsx watch src/server/main.ts
pnpm dev:web          # vite
pnpm build            # build:web then build:server
pnpm start            # node dist/server/main.js (serves web + API on one port)
pnpm test             # vitest run (single run)
pnpm test:watch       # vitest (watch mode)
pnpm typecheck        # type-check both server and web tsconfig
pnpm mdocs            # CLI tool (e.g., pnpm mdocs visitor list / migrate)
```

Run a single test file: `pnpm vitest run src/server/documents/document.service.test.ts`

## Architecture

```
src/
  server/
    routes/          Express route handlers (thin — validate, call service, respond)
    middleware/      Auth, document-auth middleware
    documents/       Document + tree services (business logic)
    domains/         Personal-domain service
    db/              Schema, connection, repositories (data access)
    storage/         File-store (read/write .md files on disk)
    identity/        Visitor registration, auth middleware, token hashing
    migrations/      Visitor migration CLI logic
    cli/             CLI entry point
    config/          Runtime config
    logger/          Logging
  web/
    app/             React components (App shell, editor, tree, settings)
    app/hooks/       Custom hooks (useAutoSave, useAutoPublish, etc.)
    i18n/            Locale files (en.ts, zh.ts)
    storage/         IndexedDB-backed drafts
    services/        API client (endpoints.ts, client.ts)
  shared/            Types and path utilities (no Node deps — usable by both sides)
```

**Data flow:** API responses use `{ data }` envelopes. Client-side `api<T>()` unwraps `data`, throws `ApiRequestError` on non-2xx. Server routes validate input, call service layer, return `{ data }` or `{ error }`. Errors thrown in services bubble up through an error-handling middleware that maps known error types (e.g. `DocumentError`) to HTTP status codes + `{ error }` responses.

**@shared alias** resolves to `src/shared` in both vite and vitest configs.

**Runtime data** lives under `~/.mdocs/` (configurable via `MDOCS_DATA_DIR`):
- `sqlite/data.sqlite` — visitors, domains, documents, attachments, audit_logs, document_invites, visitor_migrations
- `files/docs/` — Markdown files named by relative path
- `files/assets/` — uploaded assets
- `logs/` — daily rotating log files

**`domain_id` is a logical grouping in SQLite only** — never appears in file paths. Moving a doc between domains only updates the DB.

## Identity & auth

No accounts. On first visit user enters a nickname → server creates a visitor (UUID) + high-entropy token. Browser stores both in localStorage. The raw token is sent as `x-visitor-token` header; server stores only `SHA-256(token)`.

Auth middleware (`src/server/identity/auth.middleware.ts`) applies to all `/api` routes except `/visitors/register` and `/health`. It hashes the header token and resolves the visitor, attaching `req.visitor`. Routes without a valid token get 401.

## Permission model

Documents have 4 permission levels (defined in `document.service.ts`):
- **PRIVATE (0)** — owner only
- **PUBLIC_READ (1)** — anyone can read (default for default domain)
- **PUBLIC_EDIT (2)** — anyone can read and edit
- **INVITE (3)** — per-visitor invites in `document_invites` table (read or edit)

Personal domains (domain_id = visitor_id) default to PRIVATE. Deletion always requires owner.

## Document storage

Documents are `.md` files on disk under `files/docs/`. The DB holds metadata (path, hash, permissions, ownership). `writeDocument()` in `file-store.ts` computes SHA-256 of the content buffer. Path validation in `shared/docPath.ts` rejects absolute paths, `..` traversal, non-`.md` extensions, and unsupported characters.

**Personal domain paths** are prefixed with `_personal/{visitorId}/` on disk but that prefix is stripped in the tree API for the domain owner.

## Document tree

`tree.service.ts` builds the tree by splitting every document's relative path on `/`, constructing intermediate folder nodes. Folders can have a `desc.md` file whose content describes the folder — recognized by the constant `FOLDER_DESC_FILENAME` from `shared/folderDesc.ts`.

## Frontend

React Router with 3 routes: `/` (App), `/doc/:documentId` (App), `/playground`. The `App` component is the main shell: sidebar with domain selector + document tree, main area with the editor (welcome screen when nothing selected), toolbar with new doc/folder buttons. State flows through App's useState + callbacks — no global state management.

**Settings page** (`SettingsPage.tsx`): Two tabs — "通用" (language toggle, auto-edit) and "保存与发布" (auto-publish toggle, draft list). Settings stored in localStorage under `mdocs.*` keys.

**Hooks** (`src/web/app/hooks/`):
- `useAutoSave` — debounced IndexedDB save on editor changes
- `useAutoPublish` — periodic check + publish of stale drafts
- `useCreateModal` — dialog state management for doc/folder creation
- `usePublishGuard` — conflict detection when publishing

**Drafts:** `src/web/storage/drafts.ts` — IndexedDB-backed. Auto-save via `useAutoSave` hook debounces editor changes. `useAutoPublish` hook periodically publishes stale drafts.

**Editor:** `@lobehub/editor` (local package `../my-lobe-editor`) — Vditor-based Markdown editor with Meta2d diagram support.

**i18n:** Minimal system in `src/web/i18n/` with `en.ts` and `zh.ts` locales, toggleable via settings.

## Diagrams (Meta2d in Markdown)

Diagrams live in the `.md` source as fenced blocks:

````markdown
```meta2
{ "pens": [ … ] }
```
````

The editor renders them as SVG (via `canvas2svg` + Meta2d). Saving the modal rewrites that JSON in the document with `Vditor#setValue`. Use the toolbar **Insert diagram** (or double-click a diagram). Switch **edit-mode** / **both** in the Vditor toolbar for source vs wysiwyg. Large documents: API JSON body limit is 32 MiB.

Rendering pipeline: `useFlowRenderer` hook + `registerPens` — both in the local editor package. The preview half of each diagram block shows the SVG, the other half shows the JSON source.

## File store

`src/server/storage/file-store.ts` handles all Markdown file I/O. Paths are relative (stored in DB). `writeDocument()` writes to `files/docs/{relativePath}.md`, computes SHA-256 of the content. `readDocument()` reads by relative path. Deletion removes the file. `renameDocument()` moves/renames files. All paths validated by `shared/docPath.ts` (rejects absolute, `..`, non-`.md`).

## CLI

`src/server/cli/main.ts` — `pnpm mdocs visitor list` and `pnpm mdocs visitor migrate --from X --to Y --dry-run|--confirm`. Migration merges all ownership from old visitor into new one inside a transaction, with a SQLite backup.

The migration script: backs up the SQLite file, runs inside a transaction, updates ownership of documents/domains, disables the old visitor, appends entries to `visitor_migrations` and `audit_logs`. Markdown files on disk are never moved.

## Tests

Vitest with jsdom environment. Test files live alongside source (`src/**/*.test.ts`). Mock `getDb` to return an in-memory SQLite instance for tests that need DB access.

## Clean-room policy

This project is implemented independently from `markdown-docs` (`~/ddmc/markdown-docs`). Code must not be copied or mechanically adapted from that project. The Vditor + Meta2d flow is the only acknowledged port — everything else is from scratch.

## fgbg-docs (本项目开发文档)

`fgbg-docs/` 是 mdocs 项目专用的开发文档，**不要把这个目录名当成通用惯例去其他项目找**。讨论以下主题时先读对应文档：

| Topic | Read this |
|-------|-----------|
| Architecture, data flow, runtime layout | `fgbg-docs/architecture-overview.md` |
| DB tables, fields, indexes, migration strategy | `fgbg-docs/database-schema.md` |
| HTTP API endpoints, types, error codes | `fgbg-docs/api-reference.md` |
| Frontend structure, key components, routing | `fgbg-docs/frontend-structure.md` |
| Visitor identity, token lifecycle, 5-level permission model | `fgbg-docs/auth-and-access-control.md` |
| Commit naming, merge-base, draft fork semantics | `fgbg-docs/commit-naming-and-merge-base.md` |
| Dev setup, build, debug | `fgbg-docs/development-environment.md` |
| Test strategy, running tests | `fgbg-docs/testing-strategy.md` |
| Technical decision records | `fgbg-docs/adr/` |
