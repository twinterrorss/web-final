
const matches = [
    { id: 1, homeTeam: "Arsenal", awayTeam: "Chelsea", date: "2026-11-20", status: "upcoming" },
    { id: 2, homeTeam: "Barcelona", awayTeam: "Real Madrid", date: "2026-11-18", status: "upcoming" },
    { id: 3, homeTeam: "Liverpool", awayTeam: "Arsenal", date: "2026-11-16", status: "live" },
    { id: 4, homeTeam: "Bayern", awayTeam: "Dortmund", date: "2026-11-14", status: "finished" },
    { id: 5, homeTeam: "Chelsea", awayTeam: "Liverpool", date: "2026-11-22", status: "upcoming" }
];



function filterMatches() {
    const search = searchInput.value.toLowerCase()
    const status = statusChange.value.toLowerCase()
    const filteredMatches = matches.filter((match) => {
        const searchedMatches = match.homeTeam.toLowerCase().includes(search) || match.awayTeam.toLowerCase().includes(search)
        const changedStatus = match.status === status || status === "all"
        return searchedMatches && changedStatus
    })
    console.log(filteredMatches)
}
const searchInput = document.querySelector("#match-search")

searchInput.addEventListener("input", filterMatches)

const statusChange = document.querySelector("#match-status")

statusChange.addEventListener("change", filterMatches)
filterMatches()