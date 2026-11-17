(function (window) {
  "use strict";

  if (!window.matchApi || typeof window.Match !== "function") {
    console.error("[esports-extra] Load assets/js/match-api.js before esports-extra.js.");
    return;
  }

  const baseApi = window.matchApi;
  const Match = window.Match;

  const TIMEOUT_MS = 12000;
  const HOUR = 3600 * 1000;
  const KEEP_FINISHED_MS = 24 * HOUR;

  const LOL_BASE = "https://esports-api.lolesports.com/persisted/gw";
  const LOL_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
  const VLR_BASE = "https://vlrggapi.vercel.app";
  const OPENDOTA_BASE = "https://api.opendota.com/api";

  const MANUAL_FIXTURES = {
    "Apex Legends": [],
    "Overwatch 2": []
  };

  const EXTRA_SPORTS = new Set(["Apex Legends", "Overwatch 2"]);

  function abortError() {
    const error = new Error("Request cancelled.");
    error.name = "AbortError";
    return error;
  }

  function isAbort(error) {
    return Boolean(error && error.name === "AbortError");
  }

  async function getJson(url, settings) {
    const opts = settings || {};
    const provider = opts.provider || "API";
    const external = opts.signal;
    const controller = new AbortController();
    let timedOut = false;

    function onExternalAbort() {
      controller.abort();
    }

    if (external) {
      if (external.aborted) throw abortError();
      external.addEventListener("abort", onExternalAbort, { once: true });
    }

    const timer = window.setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);

    try {
      let response;
      try {
        response = await window.fetch(url, {
          method: "GET",
          headers: opts.headers || { Accept: "application/json" },
          signal: controller.signal,
          cache: "no-store"
        });
      } catch (error) {
        if (external && external.aborted) throw abortError();
        if (timedOut) throw new Error(provider + ": request timed out after " + TIMEOUT_MS / 1000 + " seconds.");
        if (isAbort(error)) throw abortError();
        throw new Error(provider + ": request blocked (network or CORS error).");
      }

      if (!response.ok) throw new Error(provider + ": HTTP " + response.status);

      try {
        return await response.json();
      } catch (error) {
        throw new Error(provider + ": the response is not valid JSON.");
      }
    } finally {
      window.clearTimeout(timer);
      if (external) external.removeEventListener("abort", onExternalAbort);
    }
  }

  function safeBuild(items, builder, source) {
    const out = [];
    items.forEach(function (item) {
      try {
        const match = builder(item);
        if (match) out.push(match);
      } catch (error) {
        console.warn("[" + source + "] Skipping invalid event:", error.message);
      }
    });
    return out;
  }

  function norm(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function pairKey(match) {
    return [norm(match.homeTeam), norm(match.awayTeam)].sort().join("|");
  }

  function isDuplicate(candidate, list) {
    const key = pairKey(candidate);
    const time = new Date(candidate.date).getTime();
    return list.some(function (other) {
      return pairKey(other) === key &&
        Math.abs(new Date(other.date).getTime() - time) < 6 * HOUR;
    });
  }

  function statusRank(match) {
    return match.status === "live" ? 0 : match.status === "upcoming" ? 1 : 2;
  }

  function sortMatches(matches) {
    return matches.slice().sort(function (a, b) {
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return statusRank(a) === 2 ? tb - ta : ta - tb;
    });
  }

  function scoreOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function lolStatus(state) {
    const value = String(state || "").toLowerCase();
    if (value === "inprogress") return "live";
    if (value === "completed") return "finished";
    return "upcoming";
  }

  function normalizeLolEvent(event) {
    if (!event || (event.type && event.type !== "match")) return null;
    const match = event.match;
    if (!match || !Array.isArray(match.teams) || match.teams.length < 2) return null;

    const status = lolStatus(event.state);
    const startMs = new Date(event.startTime).getTime();
    if (status === "finished" && Date.now() - startMs > KEEP_FINISHED_MS) return null;

    const home = match.teams[0];
    const away = match.teams[1];
    const wins = function (team) {
      return status !== "upcoming" && team && team.result
        ? scoreOrNull(team.result.gameWins)
        : null;
    };
    const bestOf = match.strategy && match.strategy.count ? " · Bo" + match.strategy.count : "";

    return new Match({
      id: "lol-" + match.id,
      homeTeam: home.name || home.code || "TBD",
      awayTeam: away.name || away.code || "TBD",
      date: event.startTime,
      status: status,
      metadata: {
        league: ((event.league && event.league.name) || "LoL Esports") + bestOf,
        sport: "League of Legends",
        provider: "Lolesports (Riot)",
        homeScore: wins(home),
        awayScore: wins(away),
        odds: [],
        oddsUnavailable: true
      }
    });
  }

  async function fetchLol(signal) {
    const headers = { Accept: "application/json", "x-api-key": LOL_KEY };
    const results = await Promise.allSettled([
      getJson(LOL_BASE + "/getLive?hl=en-US", { headers: headers, signal: signal, provider: "Lolesports" }),
      getJson(LOL_BASE + "/getSchedule?hl=en-US", { headers: headers, signal: signal, provider: "Lolesports" })
    ]);
    if (signal && signal.aborted) throw abortError();

    if (results[0].status === "rejected" && results[1].status === "rejected") {
      throw results[1].reason;
    }

    const events = [];
    results.forEach(function (result) {
      if (result.status !== "fulfilled") return;
      const payload = result.value;
      const list = payload && payload.data && payload.data.schedule && payload.data.schedule.events;
      if (Array.isArray(list)) list.forEach(function (event) { events.push(event); });
    });

    const byId = new Map();
    safeBuild(events, normalizeLolEvent, "Lolesports").forEach(function (match) {
      if (!byId.has(match.id)) byId.set(match.id, match);
    });
    return Array.from(byId.values());
  }

  function parseVlrDate(value) {
    if (value === undefined || value === null || value === "") return null;
    const text = String(value).trim();
    let date;
    if (/^\d{10}$/.test(text)) {
      date = new Date(Number(text) * 1000);
    } else if (/^\d{13}$/.test(text)) {
      date = new Date(Number(text));
    } else {
      const iso = text.replace(" ", "T");
      date = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
    }
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normalizeVlrSegment(segment, status) {
    if (!segment || !segment.team1 || !segment.team2) return null;
    const date = parseVlrDate(segment.unix_timestamp) || (status === "live" ? new Date() : null);
    if (!date) return null;

    const idMatch = String(segment.match_page || "").match(/vlr\.gg\/(\d+)|^\/(\d+)/);
    const id = idMatch
      ? idMatch[1] || idMatch[2]
      : norm(segment.team1) + "-" + norm(segment.team2) + "-" + date.getTime();

    return new Match({
      id: "vlr-" + id,
      homeTeam: segment.team1,
      awayTeam: segment.team2,
      date: date.toISOString(),
      status: status,
      metadata: {
        league: segment.tournament_name || segment.round_info || "Valorant",
        sport: "Valorant",
        provider: "vlr.gg (community API)",
        homeScore: status === "live" ? scoreOrNull(segment.score1) : null,
        awayScore: status === "live" ? scoreOrNull(segment.score2) : null,
        odds: [],
        oddsUnavailable: true
      }
    });
  }

  async function fetchValorant(signal) {
    const results = await Promise.allSettled([
      getJson(VLR_BASE + "/match?q=live_score", { signal: signal, provider: "vlr.gg API" }),
      getJson(VLR_BASE + "/match?q=upcoming", { signal: signal, provider: "vlr.gg API" })
    ]);
    if (signal && signal.aborted) throw abortError();

    if (results[0].status === "rejected" && results[1].status === "rejected") {
      throw results[1].reason;
    }

    const matches = [];
    [["live", results[0]], ["upcoming", results[1]]].forEach(function (pair) {
      const status = pair[0];
      const result = pair[1];
      if (result.status !== "fulfilled") return;
      const segments = result.value && result.value.data && result.value.data.segments;
      if (!Array.isArray(segments)) return;
      safeBuild(segments, function (segment) {
        return normalizeVlrSegment(segment, status);
      }, "vlr.gg").forEach(function (match) { matches.push(match); });
    });
    return matches;
  }

  async function fetchDota(signal) {
    const list = await getJson(OPENDOTA_BASE + "/live", { signal: signal, provider: "OpenDota" });
    if (!Array.isArray(list)) throw new Error("OpenDota: unexpected response format.");

    return safeBuild(list, function (game) {
      if (!game || !game.team_name_radiant || !game.team_name_dire) return null;
      const startSec = game.activate_time || game.last_update_time;
      return new Match({
        id: "opendota-" + game.match_id,
        homeTeam: game.team_name_radiant,
        awayTeam: game.team_name_dire,
        date: startSec ? new Date(startSec * 1000).toISOString() : new Date().toISOString(),
        status: "live",
        metadata: {
          league: "Live game (score = kills)",
          sport: "Dota 2",
          provider: "OpenDota",
          homeScore: scoreOrNull(game.radiant_score),
          awayScore: scoreOrNull(game.dire_score),
          odds: [],
          oddsUnavailable: true
        }
      });
    }, "OpenDota");
  }

  function buildManual(sport) {
    const rows = MANUAL_FIXTURES[sport];
    if (!Array.isArray(rows)) return [];
    return safeBuild(rows, function (row) {
      return new Match({
        id: "manual-" + norm(sport) + "-" + norm(row.home) + "-" + norm(row.away) + "-" + String(row.date),
        homeTeam: row.home,
        awayTeam: row.away,
        date: row.date,
        status: row.status,
        metadata: {
          league: row.league || sport,
          sport: sport,
          provider: "Manual data",
          homeScore: scoreOrNull(row.homeScore),
          awayScore: scoreOrNull(row.awayScore),
          odds: [],
          oddsUnavailable: true
        }
      });
    }, "Manual");
  }

  function parseDemoTime(text) {
    const s = String(text || "");
    const now = new Date();
    const time = s.match(/(\d{1,2}):(\d{2})/);
    const date = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      time ? Number(time[1]) : 18, time ? Number(time[2]) : 0, 0, 0
    );

    if (/tomorrow/i.test(s)) {
      date.setDate(date.getDate() + 1);
    } else if (!/today/i.test(s)) {
      const dm = s.match(/(\d{1,2})\.(\d{1,2})/);
      if (dm) {
        date.setMonth(Number(dm[2]) - 1, Number(dm[1]));
        if (date.getTime() < now.getTime() - KEEP_FINISHED_MS) date.setFullYear(date.getFullYear() + 1);
      } else {
        date.setDate(date.getDate() + 1);
      }
    }
    return date;
  }

  function buildDemo(sport) {
    const store = window.cyberWinSports && window.cyberWinSports.sports;
    const data = store && store[sport];
    if (!data) return [];

    const out = [];
    const slug = norm(sport);

    (Array.isArray(data.live) ? data.live : []).forEach(function (row, index) {
      try {
        const scores = String(row[2] || "").match(/\d+/g);
        const labels = ["1", "X", "2"];
        const odds = (Array.isArray(row[3]) ? row[3] : []).map(function (value, i) {
          return { id: "demo-" + i, label: labels[i] || "Outcome", odds: Number(value), market: "1X2" };
        }).filter(function (odd) { return odd.odds > 1; });

        out.push(new Match({
          id: "demo-" + slug + "-live-" + index,
          homeTeam: row[0],
          awayTeam: row[1],
          date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          status: "live",
          metadata: {
            league: data.hero || sport,
            sport: sport,
            provider: "Demo data",
            homeScore: scores && scores.length >= 2 ? scores[0] : null,
            awayScore: scores && scores.length >= 2 ? scores[1] : null,
            odds: odds,
            oddsUnavailable: odds.length === 0
          }
        }));
      } catch (error) {
        console.warn("[Demo] Skipping invalid live row:", error.message);
      }
    });

    (Array.isArray(data.fixtures) ? data.fixtures : []).forEach(function (row, index) {
      try {
        out.push(new Match({
          id: "demo-" + slug + "-fixture-" + index,
          homeTeam: row[0],
          awayTeam: row[1],
          date: parseDemoTime(row[3]).toISOString(),
          status: "upcoming",
          metadata: {
            league: row[2] || sport,
            sport: sport,
            provider: "Demo data",
            odds: [],
            oddsUnavailable: true
          }
        }));
      } catch (error) {
        console.warn("[Demo] Skipping invalid fixture row:", error.message);
      }
    });

    return out;
  }

  const FREE_PROVIDERS = {
    "League of Legends": fetchLol,
    "Valorant": fetchValorant,
    "Dota 2": fetchDota
  };

  async function fetchMatches(sport, options) {
    const opts = options || {};
    const signal = opts.signal;
    const freeProvider = FREE_PROVIDERS[sport];
    const manual = buildManual(sport);

    if (!baseApi.supports(sport) && !freeProvider && !EXTRA_SPORTS.has(sport)) {
      throw new Error("No configured source for: " + sport + ".");
    }

    const results = await Promise.allSettled([
      baseApi.supports(sport) ? baseApi.fetchMatches(sport, opts) : Promise.resolve(null),
      freeProvider ? freeProvider(signal) : Promise.resolve(null)
    ]);
    if (signal && signal.aborted) throw abortError();

    const merged = [];
    const errors = [];
    let anySourceOk = manual.length > 0;

    results.forEach(function (result) {
      if (result.status === "rejected") {
        errors.push(result.reason && result.reason.message ? result.reason.message : "Unknown error");
        return;
      }
      if (!Array.isArray(result.value)) return;
      anySourceOk = true;
      result.value.forEach(function (match) {
        if (!isDuplicate(match, merged)) merged.push(match);
      });
    });

    manual.forEach(function (match) {
      if (!isDuplicate(match, merged)) merged.push(match);
    });

    if (merged.length === 0) {
      const demo = buildDemo(sport);
      if (demo.length > 0) {
        console.warn("[esports-extra] " + sport + ": live data is unavailable, showing sports-data.js instead.", errors);
        return sortMatches(demo);
      }
      if (!anySourceOk) {
        if (errors.length) throw new Error(errors.join(" | "));
        throw new Error(
          sport + ": no free browser-accessible API exists, and sports-data.js has no data for this game."
        );
      }
    }

    if (errors.length) console.warn("[esports-extra] Some sources failed:", errors);
    return sortMatches(merged);
  }

  window.matchApi = Object.freeze(Object.assign({}, baseApi, {
    supports: function (sport) {
      return baseApi.supports(sport) || EXTRA_SPORTS.has(sport);
    },
    getSupportedSports: function () {
      return Array.from(new Set(baseApi.getSupportedSports().concat(Array.from(EXTRA_SPORTS))));
    },
    getProviders: function (sport) {
      const providers = baseApi.getProviders(sport).slice();
      if (sport === "League of Legends") providers.push("Lolesports");
      if (sport === "Valorant") providers.push("vlr.gg API");
      if (sport === "Dota 2") providers.push("OpenDota");
      if (Array.isArray(MANUAL_FIXTURES[sport]) && MANUAL_FIXTURES[sport].length) providers.push("Manual");
      return providers;
    },
    fetchMatches: fetchMatches,
    loadSport: fetchMatches
  }));
})(window);
