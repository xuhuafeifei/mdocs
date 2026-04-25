# Clean-room boundary

This project is implemented independently.

## Rules

1. Do not copy, translate, or mechanically adapt any code from other projects,
   including but not limited to:
   - TypeScript files, React components, hooks, stores
   - SQL statements or schema definitions
   - Utility helpers, constants, configuration shapes
   - API route handlers or middleware
   - CSS selectors or class names derived from other codebases
2. Product ideas may overlap (Markdown store, visitor id, FTS search,
   comments). Implementations must be designed from scratch in this
   repository.
3. Reusing the logger design from `~/github/agent-demo` is allowed; it
   is the author's own demo. Even so, the `mdocs` logger is rewritten
   here with its own API surface and module boundaries.

## Verification

- Code review must confirm that new files do not share identifiers or
  structure with other projects.
- If a pattern looks similar by necessity (for example "hash a token
  with SHA-256"), re-derive the implementation locally.
