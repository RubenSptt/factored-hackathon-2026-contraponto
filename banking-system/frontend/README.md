# Frontend: Card Emergency Support

Customer-facing web app for the AI-first Card Emergency Support system
(Phase 8 in [`docs/TASKS.md`](../../docs/TASKS.md)). It is the conversation UI
where a customer reports a lost or stolen card, reviews suspicious activity and
confirms sensitive actions. Spanish and Portuguese are supported.

## Stack

- Next.js 16 (App Router, Turbopack) with React 19
- TypeScript in strict mode
- CSS Modules, no UI library and no extra runtime dependencies

Next.js 16 has breaking changes compared with earlier versions (for example,
`params` and `searchParams` are async, and `middleware` is now `proxy`). Read
the version-matched docs in `node_modules/next/dist/docs/` before writing code,
as [`AGENTS.md`](AGENTS.md) requires.

## Run locally

Requirements: Node.js 20.9 or later (the team uses Node.js 24 LTS).

```powershell
cd banking-system/frontend
npm install
npm run dev
```

Open <http://localhost:3000>. Stop the server with `Ctrl + C`.

Run `npm install` on your own operating system. Next.js installs native
binaries per platform, so a `node_modules` folder created on another OS will
not work.

## Checks before every commit

```powershell
npm run lint
npm run typecheck
npm run build
```

All three must pass. Stop `npm run dev` before `npm run build`.

## Project structure

```text
app/
├── layout.tsx              Root layout, fonts and metadata
├── page.tsx                Home route: renders the chat
├── page.module.css
├── _components/            UI components (private folder, not a route)
│   ├── ChatPanel.tsx       Chat, suggestions, locale switch, composer
│   └── ChatPanel.module.css
└── _lib/                   Non-UI logic (private folder, not a route)
    ├── i18n.ts             Interface strings in Spanish and Portuguese
    ├── card-number-guard.ts  Blocks sending a full card number
    └── chat-transport.ts   Temporary backend placeholder (see below)
```

Folders that start with `_` are private folders in the App Router: Next.js
does not turn them into routes.

## How it talks to the backend

The target flow is `Next.js -> FastAPI -> Bedrock AgentCore` (see
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)). The frontend never calls
the agent, AWS services or any tool directly.

The FastAPI chat endpoint does not exist yet and its request/response contract
is under team review. Until it is agreed, `app/_lib/chat-transport.ts` returns a
fixed reply saying that banking systems are not connected, which matches what
the deployed agent says today. The UI depends only on `sendChatMessage`, so
connecting the real API means replacing that one file.

## Security rules for the frontend

- The frontend never sends a `customer_id` or any other value as proof of
  identity. Identity comes from the trusted session (Cognito in deployment).
- The frontend never decides whether an action is allowed. It only shows the
  confirmation the backend asks for and sends the customer's answer back.
- `card-number-guard.ts` stops a customer from sending a full card number
  (13 to 19 digits that pass the Luhn check). It is a usability safeguard; the
  backend must still mask and reject sensitive data on its own.
- Cards are shown by their last four digits only.

## Languages

`app/_lib/i18n.ts` holds every interface string in Spanish (`es`, default) and
Portuguese (`pt`). The locale switch changes the interface and the `lang`
attribute of the page; the agent replies in the customer's language on its
own. Add new strings to both dictionaries: TypeScript fails the build if one
is missing.

## Roadmap

| Branch | Scope | Status |
| --- | --- | --- |
| `feature/frontend-chat-ui` | Chat, locale switch, card-number guard; then identity check, block confirmation, verified result and human handoff summary | In progress |
| `feature/frontend-card-dashboard` | Card list and card details | Planned |
| `feature/frontend-agent-tickets` | Human agent ticket queue and detail | Planned |
