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

app.use(express.json());
app.use(express.static(__dirname));

async function ensureScoresFile() {
	try {
		await fs.access(scoresFilePath);
	} catch {
		await fs.mkdir(path.dirname(scoresFilePath), { recursive: true });
		await writeScores(defaultScores);
	}
}

async function readScores() {
	await ensureScoresFile();

	try {
		const fileContents = await fs.readFile(scoresFilePath, "utf8");
		const parsedScores = JSON.parse(fileContents);

		return normalizeScores(parsedScores);
	} catch {
		await writeScores(defaultScores);
		return { ...defaultScores };
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

async function writeScores(scores) {
	const normalizedScores = normalizeScores(scores);
	await fs.mkdir(path.dirname(scoresFilePath), { recursive: true });
	await fs.writeFile(scoresFilePath, JSON.stringify(normalizedScores, null, 2));
	return normalizedScores;
}

app.get("/api/scores", async (_request, response) => {
	const scores = await readScores();
	response.json({ scores });
});

app.post("/api/scores/update", async (request, response) => {
	const { teamName, pointsToAdd } = request.body ?? {};

	if (!(teamName in defaultScores) || !Number.isFinite(pointsToAdd)) {
		response.status(400).json({ error: "Invalid score update payload." });
		return;
	}

	const currentScores = await readScores();
	currentScores[teamName] += pointsToAdd;
	const scores = await writeScores(currentScores);

	response.json({ scores });
});

app.post("/api/scores/reset", async (_request, response) => {
	const scores = await writeScores(defaultScores);
	response.json({ scores });
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