# Triwizard Scoreboard

A small web scoreboard for the Triwizard Tournament houses. The UI uses a dark magical theme and displays four house cards for Gryffindor, Hufflepuff, Ravenclaw, and Slytherin in a centered responsive layout, while a small Node backend stores shared tournament state in a JSON file.

## Features

- Dark magical background and centered page layout
- Round-based scoring where each saved round assigns 1st, 2nd, 3rd, and 4th place exactly once
- Automatic point totals using the fixed placement values: 1st = 4, 2nd = 3, 3rd = 2, 4th = 1
- Dynamic number of rounds with the ability to delete any saved round
- Per-house total points plus visible placement history for every saved round
- Admin mode gate for round controls
- Admin-only end game flow with final winner screen, plus the ability to resume a concluded game
- Small Express backend with JSON state storage

## Requirements

- Node.js 20.6 or newer (for built-in `--env-file` support)
- npm

## Project Structure

- `index.html` - page structure and scoreboard markup
- `style.css` - visual styling and responsive layout
- `script.js` - client-side rendering, admin mode, and API calls
- `server.js` - Express server and score API
- `data/scores.json` - shared persisted score data
- `assets/` - house crest SVGs and background art
- `package.json` - backend scripts and dependencies
- `Dockerfile` - single-stage Node image for production
- `docker-compose.yml` - runs the container with persistent data volume

## Run Locally

Copy the example env file and set the admin password:

```bash
cp .env.example .env
# then edit .env and set ADMIN_PASSWORD=<your password>
```

Install dependencies and start the Node server:

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

If you want to run on a different port, set the `PORT` environment variable before starting the server.

## Deploy with Docker

Build and run the container:

```bash
docker compose up -d --build
```

`data/scores.json` is bind-mounted from the host so score data persists across restarts and redeploys. The container binds to `127.0.0.1:3000` and expects a reverse proxy (nginx) in front of it for public traffic.

For full server setup instructions including nginx config, SSL via certbot, and redeploy steps, see [DEPLOY.md](DEPLOY.md).

## Admin Access

- Round controls are hidden by default
- Click the castle button in the header to open the password prompt
- Set `ADMIN_PASSWORD` in a local `.env` file (see `.env.example`); the server reads it on startup and verifies the prompt via `POST /api/admin/login`
- Incorrect passwords surface an alert so the user knows to try again
- On success, the server returns a SHA-256 hash of the password as a bearer token; the client stores it in `localStorage` under `triwizardAdmin` and sends `Authorization: Bearer <token>` with every mutation
- All write endpoints (`/api/scores/rounds*`, `/api/scores/reset`, `/api/scores/end`, `/api/scores/resume`) verify the token server-side with `crypto.timingSafeEqual` and reject missing/invalid tokens with 401
- Rotating `ADMIN_PASSWORD` on the server invalidates every previously issued token; stale clients get auto-logged-out on their next mutation attempt
- Shared tournament state is loaded from the backend JSON file, not from the browser

## Round Workflow

- In admin mode, assign each house a place for the current round using the 1st, 2nd, 3rd, and 4th buttons on the house cards
- A place can only be assigned once within the current draft round
- Clicking the currently selected place again unsets it
- A round can only be saved once all four houses have a unique place
- Saved rounds appear in the round history section and can be deleted after confirmation

## API Endpoints

- `GET /api/scores` - load the full tournament state, including rounds and derived totals
- `POST /api/scores/rounds` - save a completed round with a placements payload (requires admin bearer token)
- `DELETE /api/scores/rounds/:roundId` - remove a saved round and deduct its points (requires admin bearer token)
- `POST /api/scores/reset` - clear all rounds and reset totals to 0 (requires admin bearer token)
- `POST /api/scores/end` - freeze the game and reveal the final winner (requires admin bearer token)
- `POST /api/scores/resume` - reopen a concluded game so round editing can continue (requires admin bearer token)
- `POST /api/admin/login` - verify an admin password against `ADMIN_PASSWORD`; returns `{ success: true, token }` on match, 401 otherwise

The backend writes the current tournament state to `data/scores.json`, so all users who load the same deployed app see the same values. Existing score-only JSON files are still accepted and treated as carryover totals when the server first loads them.

## Customization

- Update team names or labels in `index.html`
- Adjust colors, spacing, or layout in `style.css`
- Change admin behavior or client interactions in `script.js`
- Replace JSON storage with a database later if the project grows
