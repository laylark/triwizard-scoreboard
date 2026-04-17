# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies (Express is the only runtime dep)
- `npm start` — run the Express server on port 3000 (override with `PORT` env var)

There is no build step, no linter, and no test suite. The client is plain HTML/CSS/JS served as static files by the same Express process.

## Architecture

Single-page app with four moving parts:

- `server.js` — Express server that (a) serves the repo root as static files, (b) exposes `/api/scores*` endpoints, and (c) has a catch-all `app.get("*")` that returns `index.html`. All persistence goes through `readGameState` / `writeGameState`, which funnel through `normalizeGameState` so malformed or legacy files are self-healed.
- `data/scores.json` — the **single source of truth** for shared state. Holds `{ scores, isGameEnded }`. Created on first run by `ensureScoresFile`. `normalizeGameState` also accepts the legacy shape where the file was a bare scores object (no `isGameEnded` wrapper); preserve that backward-compat when editing.
- `index.html` — static markup for all four house cards and the winner overlay. Team identity flows through `data-team="gryffindor|hufflepuff|ravenclaw|slytherin"` attributes; `script.js` queries by those.
- `script.js` — client state machine. Keeps a local `state` object (`isAdmin`, `isLoading`, `isGameEnded`, `scores`) and re-renders on every mutation via `renderScores()` → `renderTeamOrder()` + `renderLeader()` + `renderWinnerScreen()`. Every API call toggles `isLoading` around the fetch and re-renders to disable buttons.

### Key invariants

- **Admin auth is client-side only.** The password `triwizard` is hardcoded in `script.js` as `ADMIN_PASSWORD`. The server does **not** check admin status on any endpoint — anyone who can reach the API can mutate scores. Do not add features that assume server-side auth without also adding it to `server.js`.
- **Admin session is in-memory only.** Despite what the README says about `localStorage`, `script.js` does not persist `isAdmin`; it resets on reload. If you change this, update the README.
- **Game-ended gate lives on the server.** `POST /api/scores/update` returns 409 when `isGameEnded` is true. The client also guards in `updateScore`, but the server is authoritative — keep both in sync.
- **Team order differs by role.** Admin view uses `defaultTeamOrder` (fixed). Public view sorts by score descending, ties broken by `defaultTeamOrder` index. `renderTeamOrder` physically re-appends DOM nodes to reorder.
- **Four teams are hardcoded** in both `defaultScores` (server) and `state.scores` / `teamLabels` (client). Adding a team requires editing server.js, script.js, and index.html together.

### API surface

`GET /api/scores`, `POST /api/scores/update` (`{ teamName, pointsToAdd }`), `POST /api/scores/reset`, `POST /api/scores/end`, `POST /api/scores/resume`. All write endpoints return the full normalized game state — the client replaces its state wholesale via `applyGameState`, so new server-side fields flow through automatically if added to `normalizeGameState`.
