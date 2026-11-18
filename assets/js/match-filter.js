
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
            localDateString(match.date) === selectedDate;

        return searchedMatches && changedStatus && changedDate;
    });

    filteredMatches.sort((a, b) => {
        const difference =
            new Date(a.date).getTime() -
            new Date(b.date).getTime();

        return sortOrder === "desc" ? -difference : difference;
    });

    renderMatches(filteredMatches);
}
