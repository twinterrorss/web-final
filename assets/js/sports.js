(function ($, window, document) {
  "use strict";

  var activeAlert = null;
  var alertTimer = null;
  var selectedSport = null;
  var activeApiController = null;
  var apiRequestVersion = 0;

  function showMessage(message, type) {
    var display = function () {
      activeAlert = $("<div>", {
        class: "sports-feedback alert alert-" + (type || "success"),
        role: "status",
        "aria-live": "polite",
        text: message
      }).hide().appendTo("body").fadeIn(180);
      alertTimer = window.setTimeout(hideMessage, 2400);
    };

    if (alertTimer) window.clearTimeout(alertTimer);

    if (activeAlert && activeAlert.length) {
      activeAlert.stop(true, true).fadeOut(180, function () {
        activeAlert.remove();
        activeAlert = null;
        display();
      });
      return;
    }
    display();
  }

  function hideMessage() {
    if (activeAlert && activeAlert.length) {
      activeAlert.stop(true, true).fadeOut(180, function () {
        activeAlert.remove();
        activeAlert = null;
      });
    }
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value || "Date unavailable")
      : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function showMatchApiState(section, message, type, canRetry) {
    if (!section || !section.length) return;
    section.find(".match-api-state").remove();

    var state = $("<div>", {
      class: "match-api-state alert alert-" + (type || "info") + " py-2 mb-3",
      role: type === "danger" ? "alert" : "status",
      "aria-live": type === "danger" ? "assertive" : "polite"
    }).append($("<span>", { text: message }));

    if (canRetry) {
      state.append(" ", $("<button>", {
        type: "button",
        class: "btn btn-sm btn-outline-light retry-match-api ms-2",
        text: "Try again"
      }));
    }

    var title = section.find(".section-title").first();
    if (title.length) state.insertAfter(title);
    else section.prepend(state);
  }

  function clearApiCards() {
    $("#live-matches .live-card").remove();
    $(".upcoming .fixture-list").empty();
    $("#live-matches .match-api-state, .upcoming .match-api-state").remove();
  }

  function getAbbreviation(teamName) {
    return String(teamName || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) { return word.charAt(0); })
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  function createTeamLabel(teamName) {
    return $("<span>", { class: "club" }).append(
      $("<b>", { text: getAbbreviation(teamName) }),
      document.createTextNode(" " + teamName)
    );
  }

  function renderApiOdds(match) {
    var odds = Array.isArray(match.odds) ? match.odds : [];
    if (!odds.length) {
      return $("<small>", {
        class: "api-odds-unavailable",
        text: match.provider && match.provider.indexOf("ESPN") === 0
          ? "Fixture data only · odds not supplied by ESPN"
          : "Odds are not available for this event"
      });
    }

    return $("<div>", { class: "odds api-odds" }).append(
      odds.slice(0, 6).map(function (odd) {
        var label = String(odd.label || "Outcome");
        var price = Number(odd.odds);
        if (!Number.isFinite(price) || price <= 1) return null;

        return $("<span>", {
          tabindex: "0",
          role: "button",
          "data-odd-label": label,
          "data-odd-value": price.toFixed(2),
          "aria-label": label + ", odds " + price.toFixed(2)
        }).append(
          $("<em>", { text: label }),
          document.createTextNode(" " + price.toFixed(2))
        );
      })
    );
  }

  function createSaveMatchButton(match, sport) {
    return $("<button>", {
      type: "button",
      class: "btn btn-sm btn-outline-success save-match",
      text: "Save match",
      "aria-label": "Save " + match.homeTeam + " vs " + match.awayTeam
    }).on("click", function () {
      var result = window.matchStorage.add({
        match: match.homeTeam + " vs " + match.awayTeam,
        sport: sport,
        time: match.date,
        note: ""
      });
      if (result.error) {
        showMessage(result.error, "danger");
        return;
      }
      window.dispatchEvent(new Event("schedule-changed"));
      window.location.href = "index.html#watchlist";
    });
  }

  function renderApiLiveMatch(match, sport) {
    var score = typeof match.getScoreLabel === "function"
      ? match.getScoreLabel()
      : "";

    return $("<div>", {
      class: "live-card api-live-card",
      "data-match-id": match.id
    }).append(
      $("<div>", { class: "live-teams" }).append(
        createTeamLabel(match.homeTeam),
        createTeamLabel(match.awayTeam),
        $("<small>", { text: formatDate(match.date) })
      ),
      $("<span>", { class: "tiny-live", text: "LIVE" }),
      $("<span>", { class: "current-score", text: score || "IN PLAY" }),
      $("<small>", { class: "api-match-sport", text: sport }),
      renderApiOdds(match),
      createSaveMatchButton(match, sport)
    );
  }

  function renderApiUpcomingMatch(match, sport) {
    return $("<div>", {
      class: "fixture api-fixture",
      "data-match-id": match.id
    }).append(
      createTeamLabel(match.homeTeam),
      $("<span>", { text: "vs" }),
      createTeamLabel(match.awayTeam),
      $("<em>", { text: String(match.status || "upcoming").toUpperCase() }),
      $("<small>", { text: formatDate(match.date) }),
      renderApiOdds(match),
      createSaveMatchButton(match, sport)
    );
  }

  function updateFeaturedMatch(match, sport) {
    if (!match) {
      $(".hero-team.home > strong").text("No match currently available");
      $(".hero-team.home .team-pill b").text("—");
      $(".hero-team.home .team-pill em").text("Home team");
      $(".hero-team.away .team-pill b").text("—");
      $(".hero-team.away .team-pill em").text("Away team");
      $(".hero-score small").text("STATUS");
      $(".hero-score strong").text("—");
      $(".hero-team.away .live-badge").text("● NO MATCH");
      return;
    }

    $(".hero-team.home > strong").text(sport + " · " + match.homeTeam + " vs " + match.awayTeam);
    $(".hero-team.home .team-pill b").text(getAbbreviation(match.homeTeam));
    $(".hero-team.home .team-pill em").text(match.homeTeam);
    $(".hero-team.away .team-pill b").text(getAbbreviation(match.awayTeam));
    $(".hero-team.away .team-pill em").text(match.awayTeam);
    $(".hero-score small").text(match.provider || "STATUS");
    $(".hero-score strong").text(
      typeof match.getScoreLabel === "function" && match.getScoreLabel()
        ? match.getScoreLabel()
        : String(match.status || "upcoming").toUpperCase()
    );

    var badgeText = match.status === "live"
      ? "● LIVE"
      : match.status === "finished"
        ? "● FINISHED"
        : "● UPCOMING";
    $(".hero-team.away .live-badge").text(badgeText);
  }

  async function loadApiMatches(sport) {
    if (!window.matchApi || typeof window.matchApi.fetchMatches !== "function") {
      showMessage("The match-api.js file was not loaded. Check script order in HTML.", "danger");
      return;
    }

    if (activeApiController) activeApiController.abort();

    var controller = new AbortController();
    activeApiController = controller;
    var requestVersion = ++apiRequestVersion;
    var liveSection = $("#live-matches");
    var upcomingSection = $(".upcoming");
    var fixtureList = upcomingSection.find(".fixture-list").empty();

    clearApiCards();
    liveSection.find(".section-title h2 b").text("LOADING");
    upcomingSection.find(".section-title h2 b").text("LOADING");
    showMatchApiState(liveSection, "Loading match data...", "info", false);
    showMatchApiState(upcomingSection, "Loading upcoming fixtures...", "info", false);

    try {
      var matches = await window.matchApi.fetchMatches(sport, {
        signal: controller.signal
      });

      if (requestVersion !== apiRequestVersion || selectedSport !== sport) return;
      if (!Array.isArray(matches)) {
        throw new TypeError("The Sports API did not return a matches array.");
      }

      var liveMatches = matches.filter(function (match) {
        return match.status === "live";
      });
      var nonLiveMatches = matches.filter(function (match) {
        return match.status !== "live";
      });

      liveMatches.forEach(function (match) {
        liveSection.append(renderApiLiveMatch(match, sport));
      });
      nonLiveMatches.forEach(function (match) {
        fixtureList.append(renderApiUpcomingMatch(match, sport));
      });

      liveSection.find(".section-title h2 b").text(liveMatches.length + " LIVE");
      upcomingSection.find(".section-title h2 b").text(nonLiveMatches.length + " MATCHES");

      if (matches.length === 0) {
        showMatchApiState(liveSection, "No live matches are currently available from the connected APIs.", "secondary", false);
        showMatchApiState(upcomingSection, "No fixtures were returned for this sport at the moment.", "secondary", false);
        updateFeaturedMatch(null, sport);
        return;
      }

      var providerNames = Array.from(new Set(matches.map(function (match) {
        return match.provider || "Sports API";
      })));
      var sourceLabel = providerNames.join(" + ");

      showMatchApiState(
        liveSection,
        liveMatches.length
          ? liveMatches.length + " live match(es) loaded. Source: " + sourceLabel + "."
          : "No live matches right now. Source: " + sourceLabel + ".",
        liveMatches.length ? "success" : "secondary",
        false
      );
      showMatchApiState(
        upcomingSection,
        nonLiveMatches.length
          ? nonLiveMatches.length + " other match(es) loaded. Source: " + sourceLabel + "."
          : "No other matches in the current API response.",
        nonLiveMatches.length ? "success" : "secondary",
        false
      );

      updateFeaturedMatch(liveMatches[0] || nonLiveMatches[0] || matches[0], sport);
    } catch (error) {
      if ((error && error.name === "AbortError") || requestVersion !== apiRequestVersion) return;

      clearApiCards();
      liveSection.find(".section-title h2 b").text("ERROR");
      upcomingSection.find(".section-title h2 b").text("ERROR");

      var errorMessage = error && error.message
        ? error.message
        : "Unknown API error.";
      showMatchApiState(liveSection, errorMessage, "danger", true);
      showMatchApiState(upcomingSection, "The match schedule could not be loaded.", "danger", true);
      updateFeaturedMatch(null, sport);
    } finally {
      if (requestVersion === apiRequestVersion) activeApiController = null;
    }
  }

  function renderSport(sport) {
    selectedSport = sport;

    $(".sport-tabs span").removeClass("selected").attr("aria-selected", "false").filter(function () {
      return $(this).text().replace(/^[^A-Za-z0-9]+/, "").trim() === sport;
    }).addClass("selected").attr("aria-selected", "true");

    if (window.matchApi && window.matchApi.supports(sport)) {
      loadApiMatches(sport);
      return;
    }

    if (activeApiController) {
      activeApiController.abort();
      activeApiController = null;
    }
    apiRequestVersion += 1;
    clearApiCards();
    $("#live-matches .section-title h2 b").text("UNAVAILABLE");
    $(".upcoming .section-title h2 b").text("UNAVAILABLE");
    showMatchApiState(
      $("#live-matches"),
      sport + " is not covered by the currently configured free API providers. No demo matches are shown.",
      "secondary",
      false
    );
    showMatchApiState(
      $(".upcoming"),
      "Choose a supported sport or connect a provider that explicitly covers " + sport + ".",
      "secondary",
      false
    );
    updateFeaturedMatch(null, sport);
  }

  function updateBetSlip(choice) {
    var slip = $(".bet-slip");
    if (!slip.length) return;

    var card = choice.closest(".live-card, .fixture");
    var teams = card.find(".live-teams .club, .club").map(function () {
      return $(this).text().trim().replace(/^[A-Z0-9]{1,3}\s+/, "");
    }).get();

    var rawOdd = choice.attr("data-odd-value") || choice.text();
    var oddValues = String(rawOdd).match(/\d+(?:\.\d+)?/g) || [];
    var odd = Number.parseFloat(oddValues[oddValues.length - 1]);
    if (!Number.isFinite(odd) || odd <= 1) return;

    var stake = Number.parseFloat(slip.find(".bet-stake").val());
    if (!Number.isFinite(stake) || stake < 1) {
      stake = 50;
      slip.find(".bet-stake").val("50");
    }

    var selectedLabel = choice.attr("data-odd-label") || choice.text().trim();
    slip.find(".bet-choice strong").first().text(teams.slice(0, 2).join(" vs "));
    slip.find(".bet-choice strong").eq(1).text(selectedLabel);
    slip.find(".bet-slip-odds").text(odd.toFixed(2));
    slip.find(".bet-slip-stake").text("$" + stake.toFixed(2));
    slip.find(".bet-slip-potential").text("$" + (stake * odd).toFixed(2));
    slip.find(".side-title b").text("1 ACTIVE");
    slip.find("button").prop("disabled", false).text("PLACE BET");
  }

  $(function () {
    var initiallySelected = $(".sport-tabs .selected").first().text();
    selectedSport = initiallySelected.replace(/^[^A-Za-z0-9]+/, "").trim();

    $(".sport-tabs span").each(function () {
      $(this).attr({
        tabindex: "0",
        role: "button",
        "aria-selected": $(this).hasClass("selected") ? "true" : "false"
      });
    });

    $(".sport-tabs").on("click keydown", "span", function (event) {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      var sport = $(this).text().replace(/^[^A-Za-z0-9]+/, "").trim();
      renderSport(sport);
      showMessage(sport + " selected. Match data is being updated.");
    });

    if (selectedSport) renderSport(selectedSport);

    $(".main-column").on("click", ".retry-match-api", function () {
      if (selectedSport && window.matchApi && window.matchApi.supports(selectedSport)) {
        loadApiMatches(selectedSport);
      }
    });

    $("#live-matches, .upcoming").on("click keydown", ".api-odds > span", function (event) {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      $(this).siblings().removeClass("chosen");
      $(this).addClass("chosen");
      updateBetSlip($(this));
      showMessage("Selection added to your demo bet slip.");
    });

    $(".bet-slip").each(function () {
      var slip = $(this);
      slip.find("dd").eq(0).addClass("bet-slip-stake").text("$50.00");
      slip.find("dd").eq(1).addClass("bet-slip-odds").text("—");
      slip.find("dd").eq(2).addClass("bet-slip-potential").text("—");

      if (!slip.find(".bet-stake").length) {
        $("<label>", { class: "bet-stake-label", text: "Stake" }).append(
          $("<input>", {
            class: "form-control form-control-sm bet-stake",
            type: "number",
            min: "1",
            max: "10000",
            step: "0.01",
            value: "50",
            "aria-label": "Bet stake"
          })
        ).insertBefore(slip.find(".bet-choice"));
      }
    });

    $(".bet-slip").on("input", ".bet-stake", function () {
      var slip = $(this).closest(".bet-slip");
      var stake = Math.max(1, Number.parseFloat($(this).val()) || 1);
      var odds = Number.parseFloat(slip.find(".bet-slip-odds").text()) || 0;
      slip.find(".bet-slip-stake").text("$" + stake.toFixed(2));
      slip.find(".bet-slip-potential").text(odds > 1 ? "$" + (stake * odds).toFixed(2) : "—");
    }).on("click", "button", function () {
      if ($(this).prop("disabled")) return;
      $(this).prop("disabled", true).text("BET PLACED");
      showMessage("Demo bet placed successfully.");
    });
  });
})(jQuery, window, document);
