# Voice AI Patient Registration System

A voice-based agent that registers patients over a real phone call, persists
their demographics to a database, and exposes the data through a REST API.

## Live Demo

- **Phone number:** +1 (804) 537-4036
- **API base URL:** https://voice-ai-patient-registration-production-aeb0.up.railway.app
- Call the number above to register as a patient; then check
  `GET /patients` on the API base URL to see the saved record.

## Features

- **Natural voice registration** — the agent collects all required
  demographics conversationally, confirms everything back to the caller,
  and only saves after explicit confirmation.
- **Returning-caller detection** — as soon as a phone number is collected,
  the agent checks for an existing patient with that number and offers to
  update the record instead of creating a duplicate.
- **Dashboard** — `dashboard.html` is a lightweight, read-only view of all
  registered patients for quickly checking what's in the database without
  calling the API directly. Open the file in any browser; it talks to the
  live API above and auto-refreshes every 15 seconds. No build step or
  server needed — it's a single static HTML file.

## Architecture

```
Phone Call (Caller)
      |
      v
Voice AI Agent  <-- Vapi / Retell (telephony + STT/TTS + LLM orchestration)
      |  (calls REST API as "tools" during the conversation)
      v
REST API  <-- Node.js / Express  (routes/patients.js)
      |         - server-side validation (validation.js), independent of the agent
      v
SQLite  <-- db/database.js  (better-sqlite3, WAL mode, persists to patients.db)
```

**Separation of concerns:** the voice platform (Vapi/Retell) never touches the
database directly. It calls the same REST endpoints an API client would, so
validation and persistence logic live in exactly one place.

## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Telephony + Voice | Vapi or Retell | Abstracts STT/TTS/phone provisioning so time goes into the conversation design and integration, not building a speech pipeline from scratch |
| Backend | Node.js / Express | Fast to scaffold, one language across the stack, easy to deploy anywhere |
| Database | SQLite (built-in `node:sqlite`) | Zero-config, file-based, fully sufficient for this scope; survives restarts by design (it's a file on disk). Uses Node's native SQLite module instead of `better-sqlite3` specifically to avoid a native-compilation step (`node-gyp`/Visual Studio Build Tools) that isn't guaranteed to be available on a reviewer's or a fresh dev machine — one less thing that can break a 3-hour build |
| Hosting | Railway / Render / ngrok | Any of these gets a public HTTPS URL fast, which both the voice platform and reviewers need |

## Setup

Requires **Node.js 22.13+** (built-in `node:sqlite` needs no flag from that
version onward; this project targets Node 24). No native build tools required.

```bash
npm install
cp .env.example .env      # adjust PORT / DATABASE_PATH if needed
npm run seed               # optional: adds 2 demo patients
npm start                  # starts the API on http://localhost:3000
```

You'll see an `ExperimentalWarning: SQLite is an experimental feature` in the
console — that's expected and harmless; `node:sqlite` is a Release Candidate
as of Node 24.15 but still logs this warning.

Verify it's running:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/patients
```

## Connecting the voice agent

1. Deploy this API somewhere with a public URL (Railway/Render are fastest, or
   `ngrok http 3000` for a quick tunnel during local testing).
2. Create an agent in Vapi or Retell, provision a phone number.
3. Paste the system prompt from **`VOICE_AGENT_PROMPT.md`** into the agent's
   instructions field.
4. Register the three tools defined in the same file (`find_patient_by_phone`,
   `create_patient`, `update_patient`), pointing each at your deployed API base
   URL.
5. Call the number and test a full registration.

## API Reference

All responses use the envelope `{ "data": ..., "error": ... }`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/patients` | List patients. Filters: `?last_name=`, `?date_of_birth=`, `?phone_number=` |
| GET | `/patients/:id` | Get one patient by `patient_id` |
| POST | `/patients` | Create a patient (422 with an array of error messages on invalid input) |
| PUT | `/patients/:id` | Partial update |
| DELETE | `/patients/:id` | Soft delete (sets `deleted_at`; row is retained) |

## Data model

Matches the assessment's field list exactly — see `db/database.js` for the
full schema, including `CHECK` constraints on `sex` and NOT NULL on required
fields. `patient_id` is a UUID generated at creation. `created_at` /
`updated_at` are UTC ISO-8601 timestamps managed by the app layer.

## Observability

Every create/update/delete logs a structured line to stdout
(`[PATIENT CREATED] {...}`, etc.), along with a request log line for every
incoming HTTP call. In production this would ship to a log aggregator instead
of stdout.

## Known limitations / trade-offs

- **No auth on the API.** Acceptable for this assessment's scope; a real
  deployment would put a shared secret or API key in front of `/patients`
  (see the commented `WEBHOOK_SECRET` in `.env.example` as the intended hook).
- **SQLite, not Postgres.** Chosen deliberately for zero-setup persistence
  within the time limit. `node:sqlite` is synchronous, which is fine at this
  scale but wouldn't be the right choice under real concurrent load. It's
  also still an experimental/RC Node API, not yet recommended for production.
- **State-name conversion ("Texas" -> "TX") is delegated to the LLM** in the
  system prompt rather than handled server-side. This is a reasonable
  trade-off for a 3-hour build but a fuzzy-matching layer server-side would
  be more robust.
- **No automated test suite included** given the time budget — manual `curl`
  verification covered create/read/update/soft-delete and the restart-
  persistence check.
- **Dropped-call handling** is described in the system prompt (end gracefully
  after prolonged silence) but actual mid-call reconnection/resume is not
  implemented — a dropped call currently means the caller starts over.

## Next steps (if given more time)

- Add a shared-secret header check on the API so only the voice platform (and
  authenticated dashboard users) can hit it.
- Store a call transcript/summary linked to each `patient_id`.
- Add automated integration tests for the API layer.
- Add appointment scheduling and multi-language support to the conversation flow.
