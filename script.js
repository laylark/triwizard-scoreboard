"use strict";

const ADMIN_PASSWORD = "triwizard";
const SCORES_API_URL = "/api/scores";

const state = {
	isAdmin: false,
	isLoading: false,
	isGameEnded: false,
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
const teamsContainer = document.querySelector(".teams");
const adminLoginButton = document.querySelector("#admin-login");
const endGameButton = document.querySelector("#end-game");
const resetButton = document.querySelector("#reset-scores");
const resumeGameButton = document.querySelector("#resume-game");
const restartGameButton = document.querySelector("#restart-game");
const logoutButton = document.querySelector("#logout-admin");
const currentLeader = document.querySelector("#current-leader");
const winnerTitle = document.querySelector("#winner-title");
const winnerSubtitle = document.querySelector("#winner-subtitle");
const defaultTeamOrder = ["gryffindor", "hufflepuff", "ravenclaw", "slytherin"];

function applyGameState(payload) {
	const nextScores = payload?.scores;
	state.isGameEnded = payload?.isGameEnded === true;

	Object.keys(state.scores).forEach((teamName) => {
		const savedValue = nextScores?.[teamName];

		if (typeof savedValue === "number" && Number.isFinite(savedValue)) {
			state.scores[teamName] = savedValue;
		}
	});
}

function renderAdminMode() {
	pageBody.classList.toggle("admin-mode", state.isAdmin);
	if (adminLoginButton) {
		adminLoginButton.hidden = state.isAdmin;
	}
	renderTeamOrder();
}

function renderWinnerScreen() {
	const winnerName = getCurrentLeader();
	pageBody.classList.toggle("game-ended", state.isGameEnded);

	if (winnerTitle) {
		winnerTitle.textContent = winnerName;
	}

	if (winnerSubtitle) {
		winnerSubtitle.textContent = winnerName === "Tie"
			? "The tournament ends in a tie."
			: `${winnerName} claims the Triwizard Cup.`;
	}
}

function promptForAdminAccess() {
	if (state.isAdmin) {
		return;
	}

	const enteredPassword = window.prompt("Enter admin password to manage house scores:");

	if (enteredPassword === ADMIN_PASSWORD) {
		state.isAdmin = true;
		renderAdminMode();
		renderScores();
	}
}

function renderScores() {
	renderTeamOrder();

	teamCards.forEach((teamCard) => {
		const teamName = teamCard.dataset.team;
		const scoreElement = teamCard.querySelector(".score");
		const controls = teamCard.querySelectorAll(".score-button");

		if (!teamName || !scoreElement) {
			return;
		}

		scoreElement.textContent = String(state.scores[teamName] ?? 0);
		controls.forEach((button) => {
			button.disabled = state.isLoading || state.isGameEnded;
		});
	});

	if (resetButton) {
		resetButton.disabled = state.isLoading;
	}

	if (endGameButton) {
		endGameButton.disabled = state.isLoading || state.isGameEnded;
	}

	if (restartGameButton) {
		restartGameButton.disabled = state.isLoading;
	}

	if (resumeGameButton) {
		resumeGameButton.disabled = state.isLoading;
	}

	renderLeader();
	renderWinnerScreen();
}

function getSortedTeamNames() {
	if (state.isAdmin) {
		return [...defaultTeamOrder];
	}

	return [...defaultTeamOrder].sort((leftTeam, rightTeam) => {
		const scoreDifference = (state.scores[rightTeam] ?? 0) - (state.scores[leftTeam] ?? 0);

		if (scoreDifference !== 0) {
			return scoreDifference;
		}

		return defaultTeamOrder.indexOf(leftTeam) - defaultTeamOrder.indexOf(rightTeam);
	});
}

function renderTeamOrder() {
	if (!teamsContainer) {
		return;
	}

	const cardsByTeam = new Map(
		[...teamCards].map((teamCard) => [teamCard.dataset.team, teamCard])
	);

	getSortedTeamNames().forEach((teamName) => {
		const teamCard = cardsByTeam.get(teamName);

		if (teamCard) {
			teamsContainer.appendChild(teamCard);
		}
	});
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
		applyGameState(payload);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

async function updateScore(teamName, pointsToAdd) {
	if (!state.isAdmin || state.isGameEnded || !(teamName in state.scores)) {
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
		applyGameState(payload);
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
		applyGameState(payload);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

function logoutAdmin() {
	state.isAdmin = false;

	renderAdminMode();
	renderScores();
}

async function endGame() {
	if (!state.isAdmin || state.isGameEnded) {
		return;
	}

	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(`${SCORES_API_URL}/end`, {
			method: "POST",
		});

		if (!response.ok) {
			throw new Error("Failed to end game.");
		}

		const payload = await response.json();
		applyGameState(payload);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

async function resumeGame() {
	if (!state.isAdmin || !state.isGameEnded) {
		return;
	}

	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(`${SCORES_API_URL}/resume`, {
			method: "POST",
		});

		if (!response.ok) {
			throw new Error("Failed to resume game.");
		}

		const payload = await response.json();
		applyGameState(payload);
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

teamCards.forEach((teamCard) => {
	teamCard.addEventListener("click", async (event) => {
		if (!state.isAdmin || state.isGameEnded) {
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

restartGameButton?.addEventListener("click", async () => {
	await resetScores();
});

resumeGameButton?.addEventListener("click", async () => {
	await resumeGame();
});

endGameButton?.addEventListener("click", async () => {
	await endGame();
});

logoutButton?.addEventListener("click", () => {
	logoutAdmin();
});

adminLoginButton?.addEventListener("click", () => {
	promptForAdminAccess();
});

renderAdminMode();
fetchScores();
