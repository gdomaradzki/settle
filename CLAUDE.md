@AGENTS.md

**When starting work on a Next.js project, ALWAYS call the `init` tool from
next-devtools-mcp FIRST to set up proper context and establish documentation
requirements. Do this automatically without being asked.**

# Project instructions for Claude

## Tech stack
- TypeScript strict mode.
- React + Next.js App Router.
- Use shadcn/ui for UI components.
- Use Tailwind for styling.

## Coding rules
- Do not use `any` in TypeScript.
  - Prefer `unknown`, generics, discriminated unions, or explicit domain types.
- Do not add new UI libraries without asking.
- Prefer composition over large components.
- Keep components under 150 lines when practical.