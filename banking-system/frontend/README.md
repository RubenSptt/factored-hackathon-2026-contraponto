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
├── layout.tsx                Root layout, fonts and metadata
├── page.tsx                  Home route: renders the chat
├── page.module.css
├── _components/              UI components (private folder, not a route)
│   ├── ChatPanel.tsx         Conversation, locale switch, composer, session
│   ├── ActionCard.tsx        Renders each structured UI action from the backend
│   └── *.module.css
└── _lib/                     Non-UI logic (private folder, not a route)
    ├── api/
    │   ├── contracts.ts      Request/response types shared with FastAPI
    │   ├── mock-api.ts       In-memory mock of the backend (demo scenario)
    │   └── index.ts          Exports the client the UI uses
    ├── i18n.ts               Interface strings in Spanish and Portuguese
    └── card-number-guard.ts  Blocks sending a full card number
```

Folders that start with `_` are private folders in the App Router: Next.js
does not turn them into routes.

## How it talks to the backend

The target flow is `Next.js -> FastAPI -> Bedrock AgentCore` (see
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)). The frontend never calls
the agent, AWS services or any tool directly.

The FastAPI endpoints do not exist yet, so the UI runs against an in-memory
mock (`app/_lib/api/mock-api.ts`) that follows the contract in
`app/_lib/api/contracts.ts`. To connect the real backend, write an HTTP client
that implements `CardSupportApi` and export it from `app/_lib/api/index.ts`;
no component changes are needed.

### Contract (proposed, pending backend confirmation)

Field names are snake_case to match Pydantic models and the handoff JSON in
`PRODUCT.md`. No request carries `customer_id`.

| Endpoint | Request | Purpose |
| --- | --- | --- |
| `POST /chat/messages` | `session_id`, `message`, `locale` | Customer message |
| `POST /chat/verification` | `session_id`, `challenge_id`, `answer`, `locale` | Answer to a step-up question |
| `POST /chat/confirmations` | `session_id`, `confirmation_id`, `decision`, `locale` | Confirm or cancel a sensitive action |

Every endpoint returns `{ reply, ui_actions }`: the agent's text plus a list of
structured actions the UI knows how to render.

| `ui_actions[].type` | What the UI shows |
| --- | --- |
| `step_up_verification` | Security question with an answer field; the answer is not echoed into the transcript |
| `transaction_review` | Recent transactions of the affected card (`city: null` is shown as "not recorded") |
| `confirm_action` | Explicit confirm/cancel for `block_card` |
| `action_result` | Outcome of the action; `verified: true` only when the backend re-read the card status |
| `handoff_created` | Case summary for the customer; the full `HumanHandoff` object goes to the human agent |

### Demo scenario in the mock

1. Report an incident ("Me robaron la billetera y veo una compra que no hice").
2. Answer the security question with any city: verification passes. Answer
   "no sé" / "não sei" to see the failed-verification path, which escalates to
   a human without touching the card.
3. Reply to the transaction review, then confirm or cancel the block.
4. Confirming returns a verified block result plus a human handoff; cancelling
   returns a handoff only.

All mock data is fictional; nothing is read from the hackathon dataset.

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
| `feature/frontend-chat-ui` | Chat, locale switch, card-number guard, API contract and mock, identity check, transaction review, block confirmation, verified result and handoff summary | Ready for review |
| `feature/frontend-card-dashboard` | Card list and card details | Planned |
| `feature/frontend-agent-tickets` | Human agent ticket queue and detail | Planned |
