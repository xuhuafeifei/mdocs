# mdocs

Markdown knowledge base for small teams.

- TypeScript front-end and back-end
- Vite + React web, Express back-end
- SQLite metadata, Markdown files as primary storage
- Lightweight visitor identity, no account system
- Runs locally or on a small team server

> 文档站点：[xuhuafeifei.github.io/mdocs-site](https://xuhuafeifei.github.io/mdocs-site/)

编辑界面图片:
<img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/605e7299-7485-4809-a9e1-0918c686d5fd" />
**上述文章是通过mdocs-cli由agent阅读Deepseek-TUI代码后推送的**

后台界面
<img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/aba8ae95-40d5-49ba-a469-7665f8e3f21b" />


## Clean-room policy

`mdocs` is implemented from scratch. It MUST NOT reuse any code from
`markdown-docs` (located at `~/ddmc/markdown-docs`). That includes, but is
not limited to:

- Source files, functions, classes, interfaces, types
- SQL statements or schema definitions
- React components, hooks, CSS
- Utility helpers and configuration shapes
- API route wiring or identity logic

Reuse of the `agent-demo` logger design is permitted because it is the
author's own demo project.

The **Meta2d / Vditor flow** matches `markdown-docs`: `useFlowRenderer`,
`registerPens`, fenced `` ```meta2 `` blocks with inline JSON, **wysiwyg**
mode (not IR), SVG preview in the preview half of each block, and
`window.vditorInstance` for `getValue` / `setValue` when editing or deleting
blocks.

## Diagrams (Meta2d in Markdown)

Diagrams live in the `.md` source as fenced blocks:

````markdown
```meta2
{ "pens": [ … ] }
```
````

The editor renders them as SVG (via `canvas2svg` + Meta2d, same approach as
`markdown-docs`). Saving the modal rewrites that JSON in the document with
`Vditor#setValue`. Use the toolbar **Insert diagram** (or double-click a
diagram). Switch **edit-mode** / **both** in the Vditor toolbar for source vs
wysiwyg. Large documents: API JSON body limit is 32&nbsp;MiB.

## Layout

```
src/
  server/    Node back-end
  web/       Vite React front-end
  shared/    Cross-cutting types and schemas
```

Runtime data lives under `~/.mdocs/`:

```
~/.mdocs/
  data.sqlite
  files/
    docs/
    assets/
  logs/
```

`domain_id` is a logical grouping inside SQLite and does not appear in file
paths. Moving a document between domains only updates the database.

## Development

```bash
pnpm install
pnpm dev:server   # http://localhost:4000
pnpm dev:web      # http://localhost:5173, proxies /api
```

## Build and run

```bash
pnpm build
pnpm start        # serves web static files and /api on one port
```

## Visitor identity

On first visit the user enters a nickname. The server issues a
`visitor_id` (UUID) and a high-entropy `visitor_token`. The browser keeps
the raw token; the server only stores `SHA-256(token)`. Each request
sends the raw token in an `x-visitor-token` header; the server hashes it
and looks up the visitor.

## Visitor migration

If the browser cache is cleared a user will register a new visitor. An
administrator can merge the old identity into the new one:

```bash
pnpm mdocs visitor migrate --from OLD_VISITOR_ID --to NEW_VISITOR_ID --dry-run
pnpm mdocs visitor migrate --from OLD_VISITOR_ID --to NEW_VISITOR_ID --confirm
```

The script backs up the SQLite file, runs inside a transaction, updates
ownership, disables the old visitor, and appends an entry to
`visitor_migrations` and `audit_logs`. Markdown files are never moved.
