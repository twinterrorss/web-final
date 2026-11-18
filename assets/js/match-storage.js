(function (window) {
  "use strict";

  const key = storageKeys.schedule;

  function newId() {
    return "match-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function validTime(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) return false;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return false;
    // Date can silently turn February 30 into a day in March.
    const calendarDate = new Date(value.slice(0, 10) + "T00:00:00Z");
    return Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === value.slice(0, 10);
  }

  function validEntry(entry) {
    return entry !== null && typeof entry === "object" &&
      typeof entry.match === "string" && entry.match.trim().length > 0 && entry.match.length <= 80 &&
      typeof entry.sport === "string" && entry.sport.trim().length > 0 && entry.sport.length <= 60 &&
      validTime(entry.time);
  }

  function load() {
    let raw;
    try {
      raw = window.localStorage.getItem(key);
    } catch (error) {
      return { rows: [], error: "Browser storage is unavailable. Saved matches could not be read." };
    }
    if (raw === null) return { rows: [] };

    let entries;
    try {
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) throw new Error("Invalid schedule");
    } catch (error) {
      return { rows: [], warning: "Saved schedule is damaged. You can create a new schedule." };
    }

    let damaged = false;
    const ids = new Set();
    const rows = [];
    entries.forEach(function (entry, index) {
      if (!validEntry(entry)) {
        damaged = true;
        return;
      }
      let id = typeof entry.id === "string" && entry.id ? entry.id : "legacy-" + index;
      while (ids.has(id)) id += "-" + index;
      ids.add(id);
      const validNote = entry.note === undefined ||
        (typeof entry.note === "string" && entry.note.length <= 1000);
      if (!validNote) damaged = true;
      rows.push({
        id: id,
        match: entry.match.trim(),
        sport: entry.sport.trim(),
        time: entry.time,
        note: validNote ? (entry.note || "") : ""
      });
    });
    return { rows: rows, warning: damaged ? "Damaged saved entries or notes were skipped. Valid matches are still available." : "" };
  }

  function change(action, id, entry) {
    const state = load();
    if (state.error) return state;
    const rows = state.rows;
    const index = rows.findIndex(function (row) { return row.id === id; });
    if (action !== "add" && index === -1) {
      return { error: "This match no longer exists. Refresh the schedule and try again." };
    }
    if (action === "delete") {
      rows.splice(index, 1);
    } else {
      if (!validEntry(entry) || typeof entry.note !== "string" || entry.note.length > 1000) {
        return { error: "Enter a match (up to 80 characters), sport, valid date and a note of up to 1000 characters." };
      }
      const row = {
        id: action === "add" ? newId() : id,
        match: entry.match.trim(), sport: entry.sport.trim(), time: entry.time, note: entry.note.trim()
      };
      if (action === "add") rows.push(row);
      else rows[index] = row;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(rows));
      return { rows: rows };
    } catch (error) {
      return { error: "Changes were not saved. Browser storage is unavailable or full. Please try again." };
    }
  }

  window.matchStorage = {
    load: load,
    add: function (entry) { return change("add", null, entry); },
    update: function (id, entry) { return change("update", id, entry); },
    remove: function (id) { return change("delete", id); }
  };
})(window);
