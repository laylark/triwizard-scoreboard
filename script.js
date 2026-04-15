"use strict";

const state = {
	scores: {
		gryffindor: 0,
		hufflepuff: 0,
		ravenclaw: 0,
		slytherin: 0,
	},
};

function renderScores() {
	const scoreElements = document.querySelectorAll(".team[data-team]");

	scoreElements.forEach((teamCard) => {
		const teamName = teamCard.dataset.team;
		const scoreElement = teamCard.querySelector(".score");

		if (!teamName || !scoreElement) {
			return;
		}

		scoreElement.textContent = String(state.scores[teamName] ?? 0);
	});
}

renderScores();
