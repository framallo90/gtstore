# AGENTS.md

## Mode
- Strict mode is enabled for this repository.
- If a requirement cannot be met, stop and report the blocker clearly.

## Project Snapshot
- Monorepo: Nx
- Frontends: `storefront` (Angular), `admin-dashboard` (Angular)
- Backend: `api` (NestJS + Prisma)
- Database: PostgreSQL

## Communication
- User-facing language: Spanish.
- Be direct and concise.
- Always report exact file paths touched.
- Always report exact commands executed for validation.

## Scope Control
- Make the smallest possible change set that solves the request.
- Do not perform refactors unless explicitly requested.
- Do not update dependencies unless explicitly requested.
- Do not edit generated or vendor paths unless explicitly requested.
- Protected paths: `dist/`, `node_modules/`, `.nx/cache/`.

## Security Rules
- Never print secrets from `.env` or environment variables.
- Never hardcode credentials, tokens, API keys, or connection strings.
- Treat any provided credential as compromised after exposure; recommend rotation.
- Prefer environment variables and `.env` placeholders only.

## Database And Prisma Rules
- Allowed commands:
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run prisma:seed`
- Never run destructive DB operations unless the user explicitly asks for them.
- Any schema change must include migration and regeneration steps.

## Validation Requirements
- Non-trivial code changes must include validation before completion.
- Backend changes: run `npm run test:api` and `npm run build:api`.
- Storefront changes: run `npm run test:storefront` and `npm run build:storefront`.
- Admin changes: run `npm run test:admin` and `npm run build:admin`.
- Cross-layer/API contract changes: validate backend plus affected frontend target.
- If validation cannot run, explicitly state what failed, why, and what remains unverified.

## Git Rules
- Do not revert user changes unrelated to the task.
- If unexpected modifications appear, stop and ask before proceeding.
- Keep commits scoped by concern when commits are requested.
- Do not amend commits unless explicitly requested.

## Done Criteria
- Requested behavior implemented.
- Relevant tests/builds executed and reported.
- No secret leakage introduced.
- No unrelated file changes included.
