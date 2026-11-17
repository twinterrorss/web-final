(function (window) {
  "use strict";

  const MOVIODDS_API_KEY = "mo_65HMN25hL8gb2bCfHtjVHBjLyc2DD0dK";
  const MOVIODDS_BASE = "https://moviodds.com";
  const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
  const REQUEST_TIMEOUT_MS = 15000;

  class Match {
    constructor({ id, homeTeam, awayTeam, date, status, metadata = {} }) {
      if (id === undefined || id === null || String(id).trim() === "") {
        throw new TypeError("A match must have an id.");
      }
      if (!String(homeTeam || "").trim() || !String(awayTeam || "").trim()) {
        throw new TypeError("A match must have both team/display names.");
      }

      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new TypeError("A match must have a valid date.");
      }

      const source = metadata && typeof metadata === "object" ? metadata : {};

      this.id = String(id);
      this.homeTeam = String(homeTeam).trim();
      this.awayTeam = String(awayTeam).trim();
      this.date = parsedDate.toISOString();
      this.status = ["upcoming", "live", "finished"].includes(status)
        ? status
        : "upcoming";

      Object.defineProperties(this, {
        league: { value: String(source.league || ""), enumerable: false },
        homeScore: { value: source.homeScore ?? null, enumerable: false },
        awayScore: { value: source.awayScore ?? null, enumerable: false },
        sport: { value: String(source.sport || ""), enumerable: false },
        provider: { value: String(source.provider || "Unknown"), enumerable: false },
        bookmaker: { value: String(source.bookmaker || ""), enumerable: false },
        odds: {
          value: Array.isArray(source.odds) ? source.odds : [],
          enumerable: false
        },
        marketName: { value: String(source.marketName || ""), enumerable: false },
        oddsUpdatedAt: { value: source.oddsUpdatedAt || null, enumerable: false },
        oddsUnavailable: {
          value: Boolean(source.oddsUnavailable),
          enumerable: false
        },
        oddsErrorCode: { value: source.oddsErrorCode || null, enumerable: false },
        kind: {
          value: source.kind === "race" ? "race" : "match",
          enumerable: false
        },
        venue: { value: String(source.venue || ""), enumerable: false },
        country: { value: String(source.country || ""), enumerable: false },
        activeRunners: { value: source.activeRunners ?? null, enumerable: false },
        totalRunners: { value: source.totalRunners ?? null, enumerable: false },
        scratchedRunners: { value: source.scratchedRunners ?? 0, enumerable: false },
        runnerCountComplete: {
          value: Boolean(source.runnerCountComplete),
          enumerable: false
        }
      });
    }

    isLive() {
      return this.status === "live";
    }

    isUpcoming() {
      return this.status === "upcoming";
    }

    isFinished() {
      return this.status === "finished";
    }

    isRace() {
      return this.kind === "race";
    }

    getStatusLabel() {
      return {
        upcoming: "UPCOMING",
        live: "LIVE",
        finished: "FINISHED"
      }[this.status];
    }

    getScoreLabel() {
      if (this.homeScore === null || this.awayScore === null) return "";
      return `${this.homeScore} - ${this.awayScore}`;
    }

    formatDate(locale) {
      return new Date(this.date).toLocaleString(locale || undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    }

    toJSON() {
      const numericId = Number(this.id);
      const outputId = Number.isSafeInteger(numericId) && String(numericId) === this.id
        ? numericId
        : this.id;

      return {
        id: outputId,
        homeTeam: this.homeTeam,
        awayTeam: this.awayTeam,
        date: this.date,
        status: this.status,
        league: this.league,
        sport: this.sport,
        provider: this.provider,
        bookmaker: this.bookmaker,
        homeScore: this.homeScore,
        awayScore: this.awayScore,
        odds: this.odds,
        oddsUnavailable: this.oddsUnavailable,
        kind: this.kind,
        venue: this.venue,
        country: this.country
      };
    }
  }

  const sportKeys = {
    Football: "soccer",
    Basketball: "basketball",
    Hockey: "ice_hockey"
  };

  const esportsGames = new Set([
    "CS2",
    "Dota 2",
    "League of Legends",
    "Valorant",
    "Rainbow Six Siege"
  ]);

  const supportedSports = new Set([
    ...Object.keys(sportKeys),
    "Horse racing",
    ...esportsGames
  ]);

  const espnEndpoints = {
    Football: [
      "soccer/eng.1",
      "soccer/esp.1",
      "soccer/ger.1",
      "soccer/ita.1",
      "soccer/fra.1",
      "soccer/uefa.champions",
      "soccer/usa.1"
    ],
    Basketball: [
      "basketball/nba",
      "basketball/wnba"
    ],
    Hockey: [
      "hockey/nhl"
    ]
  };

  const esportsPatterns = {
    "CS2": /(?:\bCS2\b|COUNTER[\s-]?STRIKE)/i,
    "Dota 2": /(?:\bDOTA\s*2\b|\bDOTA2\b)/i,
    "League of Legends": /(?:\bLOL\b|LEAGUE OF LEGENDS)/i,
    "Valorant": /\bVALORANT\b/i,
    "Rainbow Six Siege": /(?:RAINBOW\s*6|RAINBOW\s* SIX|\bR6\b)/i
  };

  function hasMoviOddsKey() {
    return Boolean(
      MOVIODDS_API_KEY &&
      !MOVIODDS_API_KEY.includes("PASTE_YOUR_NEW_MOVIODDS_API_KEY")
    );
  }

  function isAbortError(error) {
    return Boolean(error && error.name === "AbortError");
  }

  async function fetchJson(url, options) {
    const settings = options || {};
    const externalSignal = settings.signal;
    const controller = new AbortController();
    let timeoutId;

    function abortFromCaller() {
      controller.abort();
    }

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", abortFromCaller, { once: true });
      }
    }

    timeoutId = window.setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await window.fetch(url, {
        method: "GET",
        headers: settings.headers || { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store"
      });

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw new Error("The API returned a response that is not valid JSON.");
      }

      if (!response.ok) {
        const detail = payload && (payload.message || payload.error)
          ? String(payload.message || payload.error)
          : `HTTP ${response.status}`;
        throw new Error(`${settings.provider || "API"}: ${detail}`);
      }

      if (!payload || typeof payload !== "object") {
        throw new Error(`${settings.provider || "API"}: empty or invalid response.`);
      }

      return payload;
    } catch (error) {
      if (externalSignal && externalSignal.aborted) {
        const abortError = new Error("Request cancelled.");
        abortError.name = "AbortError";
        throw abortError;
      }
      if (error && error.name === "AbortError") {
        throw new Error(`${settings.provider || "API"}: request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortFromCaller);
      }
    }
  }

  function normalizeQuotes(quotes) {
    return (Array.isArray(quotes) ? quotes : [])
      .filter(function (quote) {
        return quote && !quote.suspended && Number(quote.odds_dec) > 1;
      })
      .map(function (quote) {
        return {
          id: String(quote.sel_id || ""),
          label: String(quote.label || quote.side || "Outcome"),
          odds: Number(quote.odds_dec),
          fractionalOdds: quote.odds_frac || null,
          market: quote.group_name || quote.group_id || "",
          updatedAt: quote.ts || null
        };
      });
  }

  function getMatchStatus(item) {
    if (item.in_play === true || item.inPlay === true) return "live";

    const rawStatus = String(item.status || item.state || "").toLowerCase();
    if (
      item.finished === true ||
      item.completed === true ||
      ["finished", "complete", "completed", "final", "ended", "post"].includes(rawStatus)
    ) {
      return "finished";
    }

    return "upcoming";
  }

  function parseScore(score) {
    if (score === undefined || score === null || score === "") {
      return { homeScore: null, awayScore: null };
    }
    const parts = String(score).match(/\d+/g);
    if (!parts || parts.length < 2) {
      return { homeScore: null, awayScore: null };
    }
    return { homeScore: parts[0], awayScore: parts[1] };
  }

  function normalizeMatch(item, requestedSport) {
    const quotes = normalizeQuotes(item.quotes);
    const score = parseScore(item.score);

    return new Match({
      id: item.id,
      homeTeam: item.home || item.home_team,
      awayTeam: item.away || item.away_team,
      date: item.kickoff_utc || item.date,
      status: getMatchStatus(item),
      metadata: {
        league: item.league,
        sport: item.sport || requestedSport,
        provider: "MoviOdds",
        bookmaker: "bet365",
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        odds: quotes,
        marketName: quotes[0] ? quotes[0].market : "",
        oddsUpdatedAt: item.polled_at || null,
        oddsUnavailable: quotes.length === 0
      }
    });
  }

  function normalizeRace(race, meeting) {
    const runners = Array.isArray(race.runners) ? race.runners : [];
    const activeRunners = runners.filter(function (runner) {
      return !runner.scratched && !runner.suspended;
    });

    const raceDate = race.jump_utc || race.jump_time || race.date;
    const raceStatus = String(race.status || "open").toLowerCase();
    const status = raceStatus === "running"
      ? "live"
      : ["off", "result_interim", "result_final", "abandoned", "finished"].includes(raceStatus)
        ? "finished"
        : "upcoming";

    const odds = activeRunners
      .filter(function (runner) {
        return Number(runner.win_odds) > 1;
      })
      .map(function (runner) {
        return {
          id: String(runner.runner_id || runner.id || ""),
          label: String(runner.name || runner.runner_name || "Runner"),
          odds: Number(runner.win_odds),
          fractionalOdds: runner.win_frac || null,
          market: "Fixed Win"
        };
      });

    return new Match({
      id: race.race_id || race.id,
      homeTeam: meeting.name || meeting.venue || meeting.track || "Horse racing",
      awayTeam: race.name || race.race_name || `Race ${race.number || race.race_number || ""}`.trim(),
      date: raceDate,
      status: status,
      metadata: {
        kind: "race",
        sport: "horse-racing",
        provider: "MoviOdds",
        bookmaker: "bet365",
        venue: meeting.venue || meeting.name || meeting.track || "",
        country: meeting.country || "",
        totalRunners: runners.length,
        activeRunners: activeRunners.length,
        scratchedRunners: runners.length - activeRunners.length,
        runnerCountComplete: true,
        odds: odds,
        oddsUnavailable: odds.length === 0
      }
    });
  }

  function safeNormalize(items, normalizer, sourceName) {
    const result = [];

    items.forEach(function (item) {
      try {
        result.push(normalizer(item));
      } catch (error) {
        console.warn(`[${sourceName}] Skipping invalid event:`, error.message, item);
      }
    });

    if (items.length > 0 && result.length === 0) {
      throw new Error(`${sourceName} returned events, but none had valid IDs, participants and dates.`);
    }

    return result;
  }

  function detectEsportsGame(item) {
    const text = [
      item && item.game,
      item && item.league,
      item && item.stats && item.stats.game,
      item && item.sport
    ].filter(Boolean).join(" ");

    for (const game of esportsGames) {
      const pattern = esportsPatterns[game];
      if (pattern && pattern.test(text)) return game;
    }
    return null;
  }

  async function fetchMoviOddsMatches(sport, options) {
    if (!hasMoviOddsKey()) {
      throw new Error("MoviOdds key is not configured. Add a NEW key in assets/js/match-api.js.");
    }

    const isRacing = sport === "Horse racing";
    const isEsports = esportsGames.has(sport);
    const url = new URL(isRacing ? "/racing" : "/odds", MOVIODDS_BASE);

    if (isRacing) {
      url.searchParams.set("code", "horse");
      url.searchParams.set("near", "30");
    } else {
      url.searchParams.set("sport", isEsports ? "esports" : sportKeys[sport]);
    }

    const payload = await fetchJson(url.toString(), {
      provider: "MoviOdds",
      signal: options && options.signal,
      headers: {
        Accept: "application/json",
        "X-API-Key": MOVIODDS_API_KEY
      }
    });

    if (isRacing) {
      const meetings = Array.isArray(payload.meetings) ? payload.meetings : [];
      if (!Array.isArray(payload.races)) {
        throw new Error("MoviOdds racing response is missing the races array.");
      }

      const meetingById = new Map(meetings.map(function (meeting) {
        return [String(meeting.id || meeting.meeting_id), meeting];
      }));

      return safeNormalize(payload.races, function (race) {
        const meeting = meetingById.get(String(race.meeting_id)) || {};
        return normalizeRace(race, meeting);
      }, "MoviOdds racing");
    }

    if (!Array.isArray(payload.matches)) {
      throw new Error("MoviOdds response is missing the matches array.");
    }

    let items = payload.matches;
    if (isEsports) {
      items = items.filter(function (item) {
        return detectEsportsGame(item) === sport;
      });
    }

    return safeNormalize(items, function (item) {
      return normalizeMatch(item, isEsports ? sport : sportKeys[sport]);
    }, "MoviOdds");
  }

  function getEspnEventStatus(event, competition) {
    const status = (competition && competition.status) || event.status || {};
    const type = status.type || {};
    const state = String(type.state || status.state || "").toLowerCase();

    if (type.completed === true || state === "post") return "finished";
    if (state === "in") return "live";
    return "upcoming";
  }

  function normalizeEspnEvent(event, payload, sport) {
    const competition = Array.isArray(event.competitions) ? event.competitions[0] : null;
    const competitors = competition && Array.isArray(competition.competitors)
      ? competition.competitors
      : [];
    const home = competitors.find(function (team) { return team.homeAway === "home"; }) || competitors[0];
    const away = competitors.find(function (team) { return team.homeAway === "away"; }) || competitors[1];

    const homeName = home && home.team
      ? (home.team.displayName || home.team.name || home.team.shortDisplayName)
      : "";
    const awayName = away && away.team
      ? (away.team.displayName || away.team.name || away.team.shortDisplayName)
      : "";

    const scoreValue = function (team) {
      if (!team || team.score === undefined || team.score === null || team.score === "") return null;
      return String(team.score);
    };

    const league = (event.league && event.league.name) ||
      (payload.leagues && payload.leagues[0] && payload.leagues[0].name) ||
      sport;

    return new Match({
      id: `espn-${event.id}`,
      homeTeam: homeName,
      awayTeam: awayName,
      date: event.date,
      status: getEspnEventStatus(event, competition),
      metadata: {
        league: league,
        sport: sport,
        provider: "ESPN (free fallback)",
        bookmaker: "",
        homeScore: scoreValue(home),
        awayScore: scoreValue(away),
        odds: [],
        oddsUnavailable: true
      }
    });
  }

  async function fetchESPNMatches(sport, options) {
    const endpoints = espnEndpoints[sport];
    if (!endpoints || !endpoints.length) return [];

    const tasks = endpoints.map(async function (path) {
      const url = new URL(`${ESPN_BASE}/${path}/scoreboard`);
      url.searchParams.set("limit", "100");
      const payload = await fetchJson(url.toString(), {
        provider: `ESPN ${path}`,
        signal: options && options.signal
      });

      const events = Array.isArray(payload.events) ? payload.events : [];
      return safeNormalize(events, function (event) {
        return normalizeEspnEvent(event, payload, sport);
      }, `ESPN ${path}`);
    });

    const settled = await Promise.allSettled(tasks);
    if (options && options.signal && options.signal.aborted) {
      const abortError = new Error("Request cancelled.");
      abortError.name = "AbortError";
      throw abortError;
    }

    const matches = [];
    const errors = [];
    settled.forEach(function (result) {
      if (result.status === "fulfilled") {
        matches.push.apply(matches, result.value);
      } else {
        errors.push(result.reason && result.reason.message
          ? result.reason.message
          : "Unknown ESPN error");
      }
    });

    if (matches.length === 0 && errors.length === endpoints.length) {
      throw new Error(errors.join(" | "));
    }

    const unique = new Map();
    matches.forEach(function (match) {
      const key = [
        match.homeTeam.toLowerCase(),
        match.awayTeam.toLowerCase(),
        match.date.slice(0, 10)
      ].join("|");
      if (!unique.has(key)) unique.set(key, match);
    });

    return Array.from(unique.values()).sort(function (a, b) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }

  async function fetchMatches(sport, options) {
    if (!supportedSports.has(sport)) {
      throw new Error(`No configured free API source for: ${sport}.`);
    }

    let moviMatches = null;
    let moviError = null;

    if (hasMoviOddsKey()) {
      try {
        moviMatches = await fetchMoviOddsMatches(sport, options || {});
        if (moviMatches.length > 0) return sortMatches(moviMatches);
      } catch (error) {
        if (isAbortError(error)) throw error;
        moviError = error;
        console.warn("MoviOdds request failed; trying a fallback source.", error);
      }
    } else {
      moviError = new Error("MoviOdds API key is not configured.");
    }

    if (espnEndpoints[sport]) {
      try {
        const fallbackMatches = await fetchESPNMatches(sport, options || {});
        if (fallbackMatches.length > 0) return sortMatches(fallbackMatches);
        if (moviMatches !== null) return [];
        throw new Error("ESPN returned no fixtures for the current scoreboard window.");
      } catch (espnError) {
        if (isAbortError(espnError)) throw espnError;
        const primaryMessage = moviError && moviError.message ? moviError.message : "MoviOdds returned no matches.";
        throw new Error(`${primaryMessage} ESPN fallback: ${espnError.message || "request failed"}`);
      }
    }

    if (moviMatches !== null) return [];
    throw moviError || new Error("No API provider is configured for this sport.");
  }

  function sortMatches(matches) {
    return matches.slice().sort(function (a, b) {
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }

  window.Match = Match;
  window.matchApi = Object.freeze({
    supports: function (sport) {
      return supportedSports.has(sport);
    },
    getSupportedSports: function () {
      return Array.from(supportedSports);
    },
    getProviders: function (sport) {
      const providers = [];
      if (hasMoviOddsKey()) providers.push("MoviOdds");
      if (espnEndpoints[sport]) providers.push("ESPN");
      return providers;
    },
    fetchMatches: fetchMatches,
    loadSport: fetchMatches
  });
})(window);
