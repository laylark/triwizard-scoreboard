# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies (Express is the only runtime dep)
- `npm start` — run the Express server on port 3000 (override with `PORT` env var). Loads `.env` via `node --env-file=.env`; requires `ADMIN_PASSWORD` or startup aborts. `.env.example` documents the required key.

There is no build step, no linter, and no test suite. The client is plain HTML/CSS/JS served as static files by the same Express process.

## Architecture

Single-page app with four moving parts:

- `server.js` — Express server that (a) serves the repo root as static files, (b) exposes `/api/scores*` endpoints, and (c) has a catch-all `app.get("*")` that returns `index.html`. All persistence goes through `readGameState` / `writeGameState`, which funnel through `normalizeGameState` so malformed or legacy files are self-healed.
- `data/scores.json` — the **single source of truth** for shared state. Holds `{ scores, isGameEnded }`. Created on first run by `ensureScoresFile`. `normalizeGameState` also accepts the legacy shape where the file was a bare scores object (no `isGameEnded` wrapper); preserve that backward-compat when editing.
- `index.html` — static markup for all four house cards and the winner overlay. Team identity flows through `data-team="gryffindor|hufflepuff|ravenclaw|slytherin"` attributes; `script.js` queries by those.
- `script.js` — client state machine. Keeps a local `state` object (`isAdmin`, `isLoading`, `isGameEnded`, `scores`) and re-renders on every mutation via `renderScores()` → `renderTeamOrder()` + `renderLeader()` + `renderWinnerScreen()`. Every API call toggles `isLoading` around the fetch and re-renders to disable buttons.

### Key invariants

- **Admin password is validated server-side, but mutations are not gated.** `promptForAdminAccess` POSTs to `/api/admin/login`, which compares against `process.env.ADMIN_PASSWORD` and returns 200/401. The password is never sent to the client. However, the mutation endpoints (`/api/scores/*`, `/api/scores/rounds*`) still do not check admin status — anyone who can reach them can mutate state. Do not assume server-side authorization without adding checks to those routes.
- **Admin session is persisted in `localStorage`** under the `triwizardAdmin` key via `readPersistedAdmin` / `writePersistedAdmin`; reloading the page keeps the user logged in until they click Log Out.
- **Game-ended gate lives on the server.** `POST /api/scores/update` returns 409 when `isGameEnded` is true. The client also guards in `updateScore`, but the server is authoritative — keep both in sync.
- **Team order differs by role.** Admin view uses `defaultTeamOrder` (fixed). Public view sorts by score descending, ties broken by `defaultTeamOrder` index. `renderTeamOrder` physically re-appends DOM nodes to reorder.
- **Four teams are hardcoded** in both `defaultScores` (server) and `state.scores` / `teamLabels` (client). Adding a team requires editing server.js, script.js, and index.html together.

### API surface

`GET /api/scores`, `POST /api/scores/update` (`{ teamName, pointsToAdd }`), `POST /api/scores/reset`, `POST /api/scores/end`, `POST /api/scores/resume`. All write endpoints return the full normalized game state — the client replaces its state wholesale via `applyGameState`, so new server-side fields flow through automatically if added to `normalizeGameState`. `POST /api/admin/login` (`{ password }`) is separate: it validates against `process.env.ADMIN_PASSWORD` and returns `{ success: true }` or 401 — it does not touch game state.
