"use strict";

const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = express();
const port = process.env.PORT || 3000;
const scoresFilePath = path.join(__dirname, "data", "scores.json");
const defaultScores = {
	gryffindor: 0,
	hufflepuff: 0,
	ravenclaw: 0,
	slytherin: 0,
};
const defaultGameState = {
	scores: defaultScores,
	isGameEnded: false,
};

app.use(express.json());
app.use(express.static(__dirname));

async function ensureScoresFile() {
	try {
		await fs.access(scoresFilePath);
	} catch {
		await fs.mkdir(path.dirname(scoresFilePath), { recursive: true });
		await writeGameState(defaultGameState);
	}
}

async function readGameState() {
	await ensureScoresFile();

	try {
		const fileContents = await fs.readFile(scoresFilePath, "utf8");
		const parsedState = JSON.parse(fileContents);

		return normalizeGameState(parsedState);
	} catch {
		await writeGameState(defaultGameState);
		return {
			scores: { ...defaultScores },
			isGameEnded: false,
		};
	}
}

function normalizeScores(candidateScores) {
	const normalizedScores = { ...defaultScores };

	Object.keys(defaultScores).forEach((teamName) => {
		const teamScore = candidateScores?.[teamName];

		if (typeof teamScore === "number" && Number.isFinite(teamScore)) {
			normalizedScores[teamName] = teamScore;
		}
	});

	return normalizedScores;
}

function normalizeGameState(candidateState) {
	const candidateScores = candidateState?.scores ?? candidateState;

	return {
		scores: normalizeScores(candidateScores),
		isGameEnded: candidateState?.isGameEnded === true,
	};
}

async function writeGameState(gameState) {
	const normalizedGameState = normalizeGameState(gameState);
	await fs.mkdir(path.dirname(scoresFilePath), { recursive: true });
	await fs.writeFile(scoresFilePath, JSON.stringify(normalizedGameState, null, 2));
	return normalizedGameState;
}

app.get("/api/scores", async (_request, response) => {
	const gameState = await readGameState();
	response.json(gameState);
});

app.post("/api/scores/update", async (request, response) => {
	const { teamName, pointsToAdd } = request.body ?? {};

	if (!(teamName in defaultScores) || !Number.isFinite(pointsToAdd)) {
		response.status(400).json({ error: "Invalid score update payload." });
		return;
	}

	const currentGameState = await readGameState();

	if (currentGameState.isGameEnded) {
		response.status(409).json({ error: "The game has already ended." });
		return;
	}

	currentGameState.scores[teamName] += pointsToAdd;
	const updatedGameState = await writeGameState(currentGameState);

	response.json(updatedGameState);
});

app.post("/api/scores/reset", async (_request, response) => {
	const gameState = await writeGameState(defaultGameState);
	response.json(gameState);
});

app.post("/api/scores/end", async (_request, response) => {
	const currentGameState = await readGameState();
	const gameState = await writeGameState({
		...currentGameState,
		isGameEnded: true,
	});

	response.json(gameState);
});

app.post("/api/scores/resume", async (_request, response) => {
	const currentGameState = await readGameState();
	const gameState = await writeGameState({
		...currentGameState,
		isGameEnded: false,
	});

	response.json(gameState);
});

app.get("*", (_request, response) => {
	response.sendFile(path.join(__dirname, "index.html"));
});

ensureScoresFile()
	.then(() => {
		app.listen(port, () => {
			console.log(`Triwizard scoreboard running at http://localhost:${port}`);
		});
	})
	.catch((error) => {
		console.error("Failed to start server", error);
		process.exitCode = 1;
	});