# Triwizard Scoreboard

A small web scoreboard for the Triwizard Tournament houses. The UI uses a dark magical theme and displays four house cards for Gryffindor, Hufflepuff, Ravenclaw, and Slytherin in a centered responsive layout, while a small Node backend stores shared scores in a JSON file.

## Features

- Dark magical background and centered page layout
- Four house cards in a single row on larger screens
- Distinct house color treatments
- Shared score display for each house, starting at 0
- Admin mode gate for score controls
- Admin-only end game flow with final winner screen
- Small Express backend with JSON score storage

## Requirements

- Node.js 18 or newer
- npm

## Project Structure

- `index.html` - page structure and scoreboard markup
- `style.css` - visual styling and responsive layout
- `script.js` - client-side rendering, admin mode, and API calls
- `server.js` - Express server and score API
- `data/scores.json` - shared persisted score data
- `package.json` - backend scripts and dependencies

## Run Locally

Install dependencies and start the Node server:

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

If you want to run on a different port, set the `PORT` environment variable before starting the server.

## Admin Access

- Score controls are hidden by default
- On page load, the app shows a password prompt for admin access
- The current admin password is `triwizard`
- Admin login state is stored in browser `localStorage`
- Shared scores are not stored in `localStorage`; they are loaded from the backend JSON file

## API Endpoints

- `GET /api/scores` - load current scores
- `POST /api/scores/update` - add points to a team
- `POST /api/scores/reset` - reset all scores to 0
- `POST /api/scores/end` - freeze the game and reveal the final winner

The backend writes the current scores to `data/scores.json`, so all users who load the same deployed app see the same values.

## Customization

- Update team names or labels in `index.html`
- Adjust colors, spacing, or layout in `style.css`
- Change admin behavior or client interactions in `script.js`
- Replace JSON storage with a database later if the project grows
