"use strict";

const ADMIN_STORAGE_KEY = "triwizard-scoreboard-admin";
const ADMIN_PASSWORD = "triwizard";
const SCORES_API_URL = "/api/scores";

const state = {
	isAdmin: false,
	isLoading: false,
	scores: {
		gryffindor: 0,
		hufflepuff: 0,
		ravenclaw: 0,
		slytherin: 0,
	},
};

const teamLabels = {
	gryffindor: "Gryffindor",
	hufflepuff: "Hufflepuff",
	ravenclaw: "Ravenclaw",
	slytherin: "Slytherin",
};

const pageBody = document.body;
const teamCards = document.querySelectorAll(".team[data-team]");
const resetButton = document.querySelector("#reset-scores");
const logoutButton = document.querySelector("#logout-admin");
const currentLeader = document.querySelector("#current-leader");

function applyScores(nextScores) {
	Object.keys(state.scores).forEach((teamName) => {
		const savedValue = nextScores?.[teamName];

		if (typeof savedValue === "number" && Number.isFinite(savedValue)) {
			state.scores[teamName] = savedValue;
		}
	});
}

function saveAdminState() {
	localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state.isAdmin));
}

function loadAdminState() {
	state.isAdmin = localStorage.getItem(ADMIN_STORAGE_KEY) === "true";
}

function renderAdminMode() {
	pageBody.classList.toggle("admin-mode", state.isAdmin);
}

function promptForAdminAccess() {
	if (state.isAdmin) {
		return;
	}

	const enteredPassword = window.prompt("Enter admin password to manage house scores:");

	if (enteredPassword === ADMIN_PASSWORD) {
		state.isAdmin = true;
		saveAdminState();
		renderAdminMode();
	}
}

function renderScores() {
	teamCards.forEach((teamCard) => {
		const teamName = teamCard.dataset.team;
		const scoreElement = teamCard.querySelector(".score");
		const controls = teamCard.querySelectorAll(".score-button");

		if (!teamName || !scoreElement) {
			return;
		}

		scoreElement.textContent = String(state.scores[teamName] ?? 0);
		controls.forEach((button) => {
			button.disabled = state.isLoading;
		});
	});

	if (resetButton) {
		resetButton.disabled = state.isLoading;
	}

	renderLeader();
}

function getCurrentLeader() {
	const entries = Object.entries(state.scores);
	const highestScore = Math.max(...entries.map(([, score]) => score));
	const leaders = entries.filter(([, score]) => score === highestScore);

	if (leaders.length !== 1) {
		return "Tie";
	}

	return teamLabels[leaders[0][0]] ?? "Tie";
}

function renderLeader() {
	if (!currentLeader) {
		return;
	}

	currentLeader.textContent = getCurrentLeader();
}

async function fetchScores() {
	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(SCORES_API_URL);

		if (!response.ok) {
			throw new Error("Failed to load scores.");
		}

		const payload = await response.json();
		applyScores(payload.scores);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

async function updateScore(teamName, pointsToAdd) {
	if (!state.isAdmin || !(teamName in state.scores)) {
		return;
	}

	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(`${SCORES_API_URL}/update`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ teamName, pointsToAdd }),
		});

		if (!response.ok) {
			throw new Error("Failed to update score.");
		}

		const payload = await response.json();
		applyScores(payload.scores);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

async function resetScores() {
	if (!state.isAdmin) {
		return;
	}

	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(`${SCORES_API_URL}/reset`, {
			method: "POST",
		});

		if (!response.ok) {
			throw new Error("Failed to reset scores.");
		}

		const payload = await response.json();
		applyScores(payload.scores);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

function logoutAdmin() {
	localStorage.removeItem(ADMIN_STORAGE_KEY);
	state.isAdmin = false;

	renderAdminMode();
	renderScores();
}

teamCards.forEach((teamCard) => {
	teamCard.addEventListener("click", async (event) => {
		if (!state.isAdmin) {
			return;
		}

		const button = event.target.closest(".score-button");

		if (!button) {
			return;
		}

		const teamName = teamCard.dataset.team;
		const pointsToAdd = Number(button.dataset.points);

		if (!teamName || Number.isNaN(pointsToAdd)) {
			return;
		}

		await updateScore(teamName, pointsToAdd);
	});
});

resetButton?.addEventListener("click", async () => {
	await resetScores();
});

logoutButton?.addEventListener("click", () => {
	logoutAdmin();
});

loadAdminState();
renderAdminMode();
promptForAdminAccess();
fetchScores();
