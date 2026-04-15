"use strict";

const STORAGE_KEY = "triwizard-scoreboard-scores";

const state = {
	scores: {
		gryffindor: 0,
		hufflepuff: 0,
		ravenclaw: 0,
		slytherin: 0,
	},
};

const teamCards = document.querySelectorAll(".team[data-team]");
const resetButton = document.querySelector("#reset-scores");

function saveScores() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scores));
}

function loadScores() {
	const savedScores = localStorage.getItem(STORAGE_KEY);

	if (!savedScores) {
		return;
	}

	try {
		const parsedScores = JSON.parse(savedScores);

		Object.keys(state.scores).forEach((teamName) => {
			const savedValue = parsedScores?.[teamName];

			if (typeof savedValue === "number" && Number.isFinite(savedValue)) {
				state.scores[teamName] = savedValue;
			}
		});
	} catch {
		localStorage.removeItem(STORAGE_KEY);
	}
}

function renderScores() {
	teamCards.forEach((teamCard) => {
		const teamName = teamCard.dataset.team;
		const scoreElement = teamCard.querySelector(".score");

		if (!teamName || !scoreElement) {
			return;
		}

		scoreElement.textContent = String(state.scores[teamName] ?? 0);
	});
}

function updateScore(teamName, pointsToAdd) {
	if (!(teamName in state.scores)) {
		return;
	}

	state.scores[teamName] += pointsToAdd;
	saveScores();
	renderScores();
}

function resetScores() {
	Object.keys(state.scores).forEach((teamName) => {
		state.scores[teamName] = 0;
	});

	saveScores();
	renderScores();
}

teamCards.forEach((teamCard) => {
	teamCard.addEventListener("click", (event) => {
		const button = event.target.closest(".score-button");

		if (!button) {
			return;
		}

		const teamName = teamCard.dataset.team;
		const pointsToAdd = Number(button.dataset.points);

		if (!teamName || Number.isNaN(pointsToAdd)) {
			return;
		}

		updateScore(teamName, pointsToAdd);
	});
});

resetButton?.addEventListener("click", () => {
	resetScores();
});

loadScores();
renderScores();
