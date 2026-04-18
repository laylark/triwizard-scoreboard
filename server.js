"use strict";

const crypto = require("node:crypto");
const express = require("express");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;
const scoresFilePath = path.join(__dirname, "data", "scores.json");
const defaultScores = {
	gryffindor: 0,
	hufflepuff: 0,
	ravenclaw: 0,
	slytherin: 0,
};
const placePoints = {
	1: 4,
	2: 3,
	3: 2,
	4: 1,
};
const teamNames = Object.keys(defaultScores);
const defaultGameState = {
	baseScores: { ...defaultScores },
	rounds: [],
	scores: { ...defaultScores },
	isGameEnded: false,
};

if (!process.env.ADMIN_PASSWORD) {
	console.error("ADMIN_PASSWORD is not set. Add it to your .env file (see .env.example).");
	process.exit(1);
}

const ADMIN_TOKEN = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD).digest("hex");
const ADMIN_TOKEN_BUFFER = Buffer.from(ADMIN_TOKEN, "hex");

app.use(express.json());
app.use(express.static(__dirname));

function requireAdmin(request, response, next) {
	const header = request.get("Authorization") ?? "";
	const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(header);

	if (!match) {
		response.status(401).json({ error: "Admin authentication required." });
		return;
	}

	const presented = Buffer.from(match[1].toLowerCase(), "hex");

	if (presented.length !== ADMIN_TOKEN_BUFFER.length || !crypto.timingSafeEqual(presented, ADMIN_TOKEN_BUFFER)) {
		response.status(401).json({ error: "Admin authentication required." });
		return;
	}

	next();
}

async function ensureScoresFile() {
	try {
		await fs.access(scoresFilePath);
	} catch {
		await fs.mkdir(path.dirname(scoresFilePath), { recursive: true });
		await writeGameState(defaultGameState);
	}
}

function normalizeScores(candidateScores) {
	const normalizedScores = { ...defaultScores };

	teamNames.forEach((teamName) => {
		const teamScore = candidateScores?.[teamName];

		if (typeof teamScore === "number" && Number.isFinite(teamScore)) {
			normalizedScores[teamName] = teamScore;
		}
	});

	return normalizedScores;
}

function normalizePlacements(candidatePlacements) {
	const normalizedPlacements = {};
	const usedPlaces = new Set();

	for (const teamName of teamNames) {
		const place = candidatePlacements?.[teamName];

		if (!Number.isInteger(place) || !(place in placePoints) || usedPlaces.has(place)) {
			return null;
		}

		usedPlaces.add(place);
		normalizedPlacements[teamName] = place;
	}

	return normalizedPlacements;
}

function normalizeRound(candidateRound, index) {
	const placements = normalizePlacements(candidateRound?.placements ?? candidateRound);

	if (!placements) {
		return null;
	}

	return {
		id: typeof candidateRound?.id === "string" && candidateRound.id.trim()
			? candidateRound.id.trim()
			: `round-${index + 1}`,
		label: `Round ${index + 1}`,
		placements,
	};
}

function normalizeRounds(candidateRounds) {
	if (!Array.isArray(candidateRounds)) {
		return [];
	}

	return candidateRounds.reduce((rounds, candidateRound) => {
		const normalizedRound = normalizeRound(candidateRound, rounds.length);

		if (normalizedRound) {
			rounds.push(normalizedRound);
		}

		return rounds;
	}, []);
}

function calculateScores(baseScores, rounds) {
	const computedScores = { ...baseScores };

	rounds.forEach((round) => {
		teamNames.forEach((teamName) => {
			const place = round.placements[teamName];
			computedScores[teamName] += placePoints[place] ?? 0;
		});
	});

	return computedScores;
}

function normalizeGameState(candidateState) {
	const rounds = normalizeRounds(candidateState?.rounds);
	const usesRoundModel = Array.isArray(candidateState?.rounds) || candidateState?.baseScores;
	const baseScores = normalizeScores(
		usesRoundModel ? candidateState?.baseScores : candidateState?.scores ?? candidateState
	);

	return {
		baseScores,
		rounds,
		scores: calculateScores(baseScores, rounds),
		isGameEnded: candidateState?.isGameEnded === true,
	};
}

async function readGameState() {
	await ensureScoresFile();

	try {
		const fileContents = await fs.readFile(scoresFilePath, "utf8");
		const parsedState = JSON.parse(fileContents);

		return normalizeGameState(parsedState);
	} catch {
		await writeGameState(defaultGameState);
		return normalizeGameState(defaultGameState);
	}
}

async function writeGameState(gameState) {
	const normalizedGameState = normalizeGameState(gameState);
	await fs.mkdir(path.dirname(scoresFilePath), { recursive: true });
	await fs.writeFile(scoresFilePath, JSON.stringify(normalizedGameState, null, 2));
	return normalizedGameState;
}

function ensureGameIsMutable(gameState, response) {
	if (!gameState.isGameEnded) {
		return true;
	}

	response.status(409).json({ error: "The game has already ended." });
	return false;
}

app.get("/api/scores", async (_request, response) => {
	const gameState = await readGameState();
	response.json(gameState);
});

app.post("/api/scores/rounds", requireAdmin, async (request, response) => {
	const placements = normalizePlacements(request.body?.placements);

	if (!placements) {
		response.status(400).json({ error: "Invalid round payload." });
		return;
	}

	const currentGameState = await readGameState();

	if (!ensureGameIsMutable(currentGameState, response)) {
		return;
	}

	const updatedGameState = await writeGameState({
		...currentGameState,
		rounds: [
			...currentGameState.rounds,
			{
				id: crypto.randomUUID(),
				placements,
			},
		],
	});

	io.emit("scoreUpdate", updatedGameState);
	response.json(updatedGameState);
});

app.delete("/api/scores/rounds/:roundId", requireAdmin, async (request, response) => {
	const roundId = request.params.roundId;
	const currentGameState = await readGameState();

	if (!ensureGameIsMutable(currentGameState, response)) {
		return;
	}

	const nextRounds = currentGameState.rounds.filter((round) => round.id !== roundId);

	if (nextRounds.length === currentGameState.rounds.length) {
		response.status(404).json({ error: "Round not found." });
		return;
	}

	const updatedGameState = await writeGameState({
		...currentGameState,
		rounds: nextRounds,
	});

	io.emit("scoreUpdate", updatedGameState);
	response.json(updatedGameState);
});

app.post("/api/scores/reset", requireAdmin, async (_request, response) => {
	const gameState = await writeGameState(defaultGameState);
	io.emit("scoreUpdate", gameState);
	response.json(gameState);
});

app.post("/api/scores/end", requireAdmin, async (_request, response) => {
	const currentGameState = await readGameState();
	const gameState = await writeGameState({
		...currentGameState,
		isGameEnded: true,
	});

	io.emit("scoreUpdate", gameState);
	response.json(gameState);
});

app.post("/api/scores/resume", requireAdmin, async (_request, response) => {
	const currentGameState = await readGameState();
	const gameState = await writeGameState({
		...currentGameState,
		isGameEnded: false,
	});

	io.emit("scoreUpdate", gameState);
	response.json(gameState);
});

app.post("/api/admin/login", (request, response) => {
	if (request.body?.password === process.env.ADMIN_PASSWORD) {
		response.json({ success: true, token: ADMIN_TOKEN });
		return;
	}

	response.status(401).json({ success: false, error: "Incorrect password." });
});

app.get("*", (_request, response) => {
	response.sendFile(path.join(__dirname, "index.html"));
});

ensureScoresFile()
	.then(() => {
		server.listen(port, () => {
			console.log(`Triwizard scoreboard running at http://localhost:${port}`);
		});
	})
	.catch((error) => {
		console.error("Failed to start server", error);
		process.exitCode = 1;
	});