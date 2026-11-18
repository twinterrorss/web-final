
const searchInput = document.querySelector("#match-search");
const statusChange = document.querySelector("#match-status");
const dateInput = document.querySelector("#match-date");
const sortSelect = document.querySelector("#match-sort");
const resetButton = document.querySelector("#match-reset");
const summary = document.querySelector("#match-filter-summary");

let matches = [];

function formatMatchDate(value) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function filterMatches() {
    const search = searchInput.value.toLowerCase().trim();
    const status = statusChange.value;
    const selectedDate = dateInput.value;
    const sortOrder = sortSelect.value;

    const filteredMatches = matches.filter((match) => {
        const searchedMatches =
            match.homeTeam.toLowerCase().includes(search) ||
            match.awayTeam.toLowerCase().includes(search);

        const changedStatus =
            status === "all" || match.status === status;

        const changedDate =
            selectedDate === "" ||
            formatMatchDate(match.date) === selectedDate;

        return searchedMatches && changedStatus && changedDate;
    });

    filteredMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (sortOrder === "asc") {
            return dateA - dateB;
        } else {
            return dateB - dateA;
        }
    });

    updateCards(filteredMatches);

    summary.textContent =
        `Showing ${filteredMatches.length} of ${matches.length} matches`;
}

function updateCards(filteredMatches) {
    const visibleIds = new Set(
        filteredMatches.map((match) => String(match.id))
    );

    const matchDates = new Map(
        matches.map((match) => [
            String(match.id),
            new Date(match.date).getTime()
        ])
    );

    const cards = document.querySelectorAll(
        ".api-live-card, .api-fixture"
    );

    cards.forEach((card) => {
        const matchId = card.dataset.matchId;

        if (visibleIds.has(matchId)) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });

    const containers = [
        document.querySelector("#live-matches"),
        document.querySelector(".upcoming .fixture-list")
    ];

    containers.forEach((container) => {
        if (!container) {
            return;
        }

        const cards = Array.from(
            container.querySelectorAll(".api-live-card, .api-fixture")
        );

        cards.sort((a, b) => {
            const dateA = matchDates.get(a.dataset.matchId);
            const dateB = matchDates.get(b.dataset.matchId);

            if (sortSelect.value === "asc") {
                return dateA - dateB;
            } else {
                return dateB - dateA;
            }
        });

        cards.forEach((card) => {
            container.append(card);
        });
    });
}

function resetFilters() {
    searchInput.value = "";
    statusChange.value = "all";
    dateInput.value = "";
    sortSelect.value = "asc";

    filterMatches();
}

window.addEventListener("matchesLoaded", (event) => {
    matches = event.detail.matches;
    filterMatches();
});

window.addEventListener("matchesLoading", () => {
    matches = [];
    summary.textContent = "Loading matches...";
});

window.addEventListener("matchesLoadFailed", () => {
    matches = [];
    summary.textContent = "Match data is unavailable.";
});

searchInput.addEventListener("input", filterMatches);
statusChange.addEventListener("change", filterMatches);
dateInput.addEventListener("change", filterMatches);
sortSelect.addEventListener("change", filterMatches);
resetButton.addEventListener("click", resetFilters);


