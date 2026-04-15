"use strict";

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
	renderScores();
}

function resetScores() {
	Object.keys(state.scores).forEach((teamName) => {
		state.scores[teamName] = 0;
	});

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

renderScores();
