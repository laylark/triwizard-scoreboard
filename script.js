"use strict";

const ADMIN_PASSWORD = "triwizard";
const SCORES_API_URL = "/api/scores";
const PLACE_POINTS = {
	1: 4,
	2: 3,
	3: 2,
	4: 1,
};
const defaultTeamOrder = ["gryffindor", "hufflepuff", "ravenclaw", "slytherin"];
const defaultScores = {
	gryffindor: 0,
	hufflepuff: 0,
	ravenclaw: 0,
	slytherin: 0,
};

const state = {
	isAdmin: false,
	isLoading: false,
	isGameEnded: false,
	baseScores: { ...defaultScores },
	scores: { ...defaultScores },
	rounds: [],
	draftRound: createEmptyRoundDraft(),
	pendingDeleteRoundId: null,
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
const saveRoundButton = document.querySelector("#save-round");
const clearRoundDraftButton = document.querySelector("#clear-round-draft");
const endGameButton = document.querySelector("#end-game");
const resetButton = document.querySelector("#reset-scores");
const resumeGameButton = document.querySelector("#resume-game");
const restartGameButton = document.querySelector("#restart-game");
const logoutButton = document.querySelector("#logout-admin");
const currentLeader = document.querySelector("#current-leader");
const winnerTitle = document.querySelector("#winner-title");
const winnerSubtitle = document.querySelector("#winner-subtitle");
const draftStatus = document.querySelector("#draft-status");
const roundsPanel = document.querySelector(".rounds-panel");
const roundSummary = document.querySelector("#round-summary");
const savedRoundsContainer = document.querySelector("#saved-rounds");
const deleteRoundModal = document.querySelector("#delete-round-modal");
const deleteRoundMessage = document.querySelector("#delete-round-message");
const cancelDeleteRoundButton = document.querySelector("#cancel-delete-round");
const confirmDeleteRoundButton = document.querySelector("#confirm-delete-round");

function createEmptyRoundDraft() {
	return {
		gryffindor: null,
		hufflepuff: null,
		ravenclaw: null,
		slytherin: null,
	};
}

function normalizeScores(candidateScores) {
	const normalizedScores = { ...defaultScores };

	Object.keys(normalizedScores).forEach((teamName) => {
		const score = candidateScores?.[teamName];

		if (typeof score === "number" && Number.isFinite(score)) {
			normalizedScores[teamName] = score;
		}
	});

	return normalizedScores;
}

function normalizePlacements(candidatePlacements) {
	const normalizedPlacements = {};
	const usedPlaces = new Set();

	for (const teamName of defaultTeamOrder) {
		const place = candidatePlacements?.[teamName];

		if (!Number.isInteger(place) || !(place in PLACE_POINTS) || usedPlaces.has(place)) {
			return null;
		}

		usedPlaces.add(place);
		normalizedPlacements[teamName] = place;
	}

	return normalizedPlacements;
}

function normalizeRounds(candidateRounds) {
	if (!Array.isArray(candidateRounds)) {
		return [];
	}

	return candidateRounds.reduce((rounds, candidateRound, index) => {
		const placements = normalizePlacements(candidateRound?.placements ?? candidateRound);

		if (!placements) {
			return rounds;
		}

		rounds.push({
			id: typeof candidateRound?.id === "string" && candidateRound.id.trim()
				? candidateRound.id.trim()
				: `round-${index + 1}`,
			label: `Round ${rounds.length + 1}`,
			placements,
		});

		return rounds;
	}, []);
}

function applyGameState(payload) {
	state.isGameEnded = payload?.isGameEnded === true;
	state.baseScores = normalizeScores(payload?.baseScores);
	state.scores = normalizeScores(payload?.scores);
	state.rounds = normalizeRounds(payload?.rounds);
}

function getNextRoundLabel() {
	return `Round ${state.rounds.length + 1}`;
}

function getPlaceLabel(place) {
	const suffixMap = {
		1: "st",
		2: "nd",
		3: "rd",
		4: "th",
	};

	return `${place}${suffixMap[place] ?? "th"}`;
}

function getTeamUsingPlace(place) {
	return defaultTeamOrder.find((teamName) => state.draftRound[teamName] === place) ?? null;
}

function isDraftComplete() {
	return normalizePlacements(state.draftRound) !== null;
}

function isDraftEmpty() {
	return defaultTeamOrder.every((teamName) => state.draftRound[teamName] === null);
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

function getCurrentLeader() {
	const entries = Object.entries(state.scores);
	const highestScore = Math.max(...entries.map(([, score]) => score));
	const leaders = entries.filter(([, score]) => score === highestScore);

	if (leaders.length !== 1) {
		return "Tie";
	}

	return teamLabels[leaders[0][0]] ?? "Tie";
}

function renderTeamOrder() {
	if (!teamsContainer) {
		return;
	}

	const cardsByTeam = new Map([...teamCards].map((teamCard) => [teamCard.dataset.team, teamCard]));

	getSortedTeamNames().forEach((teamName) => {
		const teamCard = cardsByTeam.get(teamName);

		if (teamCard) {
			teamsContainer.appendChild(teamCard);
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

function renderDraftStatus() {
	if (!draftStatus) {
		return;
	}

	if (!state.isAdmin) {
		draftStatus.textContent = "";
		return;
	}

	if (state.isGameEnded) {
		draftStatus.textContent = "Rounds are locked while the game is ended.";
		return;
	}

	if (isDraftComplete()) {
		draftStatus.textContent = `${getNextRoundLabel()} is complete and ready to save.`;
		return;
	}

	const missingTeams = defaultTeamOrder.filter((teamName) => !Number.isInteger(state.draftRound[teamName]));

	if (missingTeams.length === defaultTeamOrder.length) {
		draftStatus.textContent = `${getNextRoundLabel()} has not been assigned yet.`;
		return;
	}

	draftStatus.textContent = `${getNextRoundLabel()} is missing ${missingTeams.map((teamName) => teamLabels[teamName]).join(", ")}.`;
}

function renderLeader() {
	if (!currentLeader) {
		return;
	}

	currentLeader.textContent = getCurrentLeader();
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

function createEmptyStatePill(message) {
	const pill = document.createElement("p");
	pill.className = "empty-pill";
	pill.textContent = message;
	return pill;
}

function createPlacementPill(label, value, extraClassName = "") {
	const pill = document.createElement("div");
	pill.className = `placement-pill${extraClassName ? ` ${extraClassName}` : ""}`;

	const pillLabel = document.createElement("span");
	pillLabel.className = "placement-pill-label";
	pillLabel.textContent = label;

	const pillValue = document.createElement("span");
	pillValue.className = "placement-pill-value";
	pillValue.textContent = value;

	pill.append(pillLabel, pillValue);
	return pill;
}

function renderTeamCards() {
	teamCards.forEach((teamCard) => {
		const teamName = teamCard.dataset.team;
		const scoreElement = teamCard.querySelector(".score");
		const carryoverNote = teamCard.querySelector(".carryover-note");
		const placementsList = teamCard.querySelector(".placements-list");
		const placeButtons = teamCard.querySelectorAll(".place-button");

		if (!teamName || !scoreElement || !placementsList) {
			return;
		}

		scoreElement.textContent = String(state.scores[teamName] ?? 0);

		const baseScore = state.baseScores[teamName] ?? 0;
		if (carryoverNote) {
			carryoverNote.hidden = baseScore === 0;
			carryoverNote.textContent = baseScore === 0 ? "" : `Carryover points: ${baseScore}`;
		}

		placementsList.replaceChildren();
		if (state.rounds.length === 0) {
			placementsList.appendChild(createEmptyStatePill("No rounds saved yet."));
		} else {
			state.rounds.forEach((round) => {
				const place = round.placements[teamName];
				placementsList.appendChild(createPlacementPill(round.label, `${getPlaceLabel(place)} · ${PLACE_POINTS[place]} pts`));
			});
		}

		placeButtons.forEach((button) => {
			const place = Number(button.dataset.place);
			const selectedPlace = state.draftRound[teamName];
			const lockedByTeam = getTeamUsingPlace(place);
			const isSelected = selectedPlace === place;
			const isLockedByOtherTeam = Boolean(lockedByTeam && lockedByTeam !== teamName);

			button.disabled = !state.isAdmin || state.isLoading || state.isGameEnded || isLockedByOtherTeam;
			button.classList.toggle("is-active", isSelected);
			button.classList.toggle("is-locked", isLockedByOtherTeam);
			button.setAttribute("aria-pressed", String(isSelected));

			if (isLockedByOtherTeam) {
				button.title = `${getPlaceLabel(place)} is already assigned to ${teamLabels[lockedByTeam]}.`;
			} else if (isSelected) {
				button.title = `Unset ${getPlaceLabel(place)} for ${teamLabels[teamName]}.`;
			} else {
				button.title = `Set ${teamLabels[teamName]} to ${getPlaceLabel(place)}.`;
			}
		});
	});
}

function createRoundCard(round) {
	const roundCard = document.createElement("article");
	roundCard.className = "round-card";

	const header = document.createElement("div");
	header.className = "round-card-header";

	const title = document.createElement("h3");
	title.className = "round-card-title";
	title.textContent = round.label;

	const totalPoints = document.createElement("p");
	totalPoints.className = "round-card-points";
	totalPoints.textContent = `${defaultTeamOrder.length + 6} total points awarded`;

	header.append(title, totalPoints);
	roundCard.appendChild(header);

	const standings = document.createElement("div");
	standings.className = "round-card-standings";

	[1, 2, 3, 4].forEach((place) => {
		const teamName = defaultTeamOrder.find((candidateTeamName) => round.placements[candidateTeamName] === place);

		if (!teamName) {
			return;
		}

		standings.appendChild(createPlacementPill(getPlaceLabel(place), `${teamLabels[teamName]} · ${PLACE_POINTS[place]} pts`, `place-${place}`));
	});

	roundCard.appendChild(standings);

	const deleteButton = document.createElement("button");
	deleteButton.type = "button";
	deleteButton.className = "delete-round-button";
	deleteButton.dataset.roundId = round.id;
	deleteButton.textContent = "Delete Round";
	deleteButton.disabled = !state.isAdmin || state.isLoading || state.isGameEnded;
	roundCard.appendChild(deleteButton);

	return roundCard;
}

function renderRoundsPanel() {
	if (!savedRoundsContainer || !roundSummary) {
		return;
	}

	if (roundsPanel) {
		roundsPanel.hidden = !state.isAdmin;
	}

	if (!state.isAdmin) {
		return;
	}

	const roundCount = state.rounds.length;
	roundSummary.textContent = roundCount === 0
		? "No rounds saved yet."
		: `${roundCount} round${roundCount === 1 ? "" : "s"} recorded.`;

	savedRoundsContainer.replaceChildren();

	if (roundCount === 0) {
		savedRoundsContainer.appendChild(createEmptyStatePill("Save a complete round to build the tournament history."));
		return;
	}

	state.rounds.forEach((round) => {
		savedRoundsContainer.appendChild(createRoundCard(round));
	});
}

function renderDeleteModal() {
	if (!deleteRoundModal || !deleteRoundMessage) {
		return;
	}

	const activeRound = state.rounds.find((round) => round.id === state.pendingDeleteRoundId);
	const isOpen = Boolean(activeRound);

	deleteRoundModal.hidden = !isOpen;
	pageBody.classList.toggle("modal-open", isOpen);

	if (!activeRound) {
		deleteRoundMessage.textContent = "Deleting a round removes all of the points awarded in that round.";
		return;
	}

	deleteRoundMessage.textContent = `${activeRound.label} will be removed and all points from that round will be deducted from the totals.`;
	}

function renderScores() {
	renderTeamOrder();
	renderTeamCards();
	renderRoundsPanel();
	renderDraftStatus();

	if (saveRoundButton) {
		saveRoundButton.disabled = !state.isAdmin || state.isLoading || state.isGameEnded || !isDraftComplete();
	}

	if (clearRoundDraftButton) {
		clearRoundDraftButton.disabled = !state.isAdmin || state.isLoading || state.isGameEnded || isDraftEmpty();
	}

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

	if (confirmDeleteRoundButton) {
		confirmDeleteRoundButton.disabled = state.isLoading;
	}

	renderLeader();
	renderWinnerScreen();
	renderDeleteModal();
}

function promptForAdminAccess() {
	if (state.isAdmin) {
		return;
	}

	const enteredPassword = window.prompt("Enter admin password to manage house rounds:");

	if (enteredPassword === ADMIN_PASSWORD) {
		state.isAdmin = true;
		renderAdminMode();
		renderScores();
	}
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

function toggleDraftPlace(teamName, place) {
	if (!state.isAdmin || state.isLoading || state.isGameEnded || !(teamName in state.draftRound)) {
		return;
	}

	if (state.draftRound[teamName] === place) {
		state.draftRound[teamName] = null;
		renderScores();
		return;
	}

	if (getTeamUsingPlace(place) && getTeamUsingPlace(place) !== teamName) {
		return;
	}

	state.draftRound[teamName] = place;
	renderScores();
}

async function saveRound() {
	if (!state.isAdmin || state.isGameEnded || !isDraftComplete()) {
		return;
	}

	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(`${SCORES_API_URL}/rounds`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ placements: state.draftRound }),
		});

		if (!response.ok) {
			throw new Error("Failed to save round.");
		}

		const payload = await response.json();
		applyGameState(payload);
		state.draftRound = createEmptyRoundDraft();
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

function clearDraftRound() {
	if (!state.isAdmin || state.isLoading || state.isGameEnded || isDraftEmpty()) {
		return;
	}

	state.draftRound = createEmptyRoundDraft();
	renderScores();
}

function openDeleteRoundModal(roundId) {
	if (!state.isAdmin || state.isLoading || state.isGameEnded) {
		return;
	}

	state.pendingDeleteRoundId = roundId;
	renderDeleteModal();
}

function closeDeleteRoundModal() {
	state.pendingDeleteRoundId = null;
	renderDeleteModal();
}

async function deleteRound() {
	if (!state.isAdmin || state.isLoading || state.isGameEnded || !state.pendingDeleteRoundId) {
		return;
	}

	state.isLoading = true;
	renderScores();

	try {
		const response = await fetch(`${SCORES_API_URL}/rounds/${encodeURIComponent(state.pendingDeleteRoundId)}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error("Failed to delete round.");
		}

		const payload = await response.json();
		applyGameState(payload);
		closeDeleteRoundModal();
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
		state.draftRound = createEmptyRoundDraft();
		closeDeleteRoundModal();
	} catch (error) {
		console.error(error);
	} finally {
		state.isLoading = false;
		renderScores();
	}
}

function logoutAdmin() {
	state.isAdmin = false;
	closeDeleteRoundModal();
	state.draftRound = createEmptyRoundDraft();
		
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
	teamCard.addEventListener("click", (event) => {
		if (!state.isAdmin || state.isGameEnded) {
			return;
		}

		const button = event.target.closest(".place-button");

		if (!button) {
			return;
		}

		const teamName = teamCard.dataset.team;
		const place = Number(button.dataset.place);

		if (!teamName || Number.isNaN(place)) {
			return;
		}

		toggleDraftPlace(teamName, place);
	});
});

savedRoundsContainer?.addEventListener("click", (event) => {
	const button = event.target.closest(".delete-round-button");

	if (!button) {
		return;
	}

	openDeleteRoundModal(button.dataset.roundId);
});

saveRoundButton?.addEventListener("click", async () => {
	await saveRound();
});

clearRoundDraftButton?.addEventListener("click", () => {
	clearDraftRound();
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

cancelDeleteRoundButton?.addEventListener("click", () => {
	closeDeleteRoundModal();
});

confirmDeleteRoundButton?.addEventListener("click", async () => {
	await deleteRound();
});

deleteRoundModal?.addEventListener("click", (event) => {
	if (event.target === deleteRoundModal) {
		closeDeleteRoundModal();
	}
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && state.pendingDeleteRoundId) {
		closeDeleteRoundModal();
	}
});

renderAdminMode();
	renderScores();
fetchScores();

const socket = io();

socket.on("scoreUpdate", (payload) => {
	if (state.isLoading) {
		return;
	}
	applyGameState(payload);
	renderScores();
});