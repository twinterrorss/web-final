const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../assets/js/match-storage.js"), "utf8");
const entry = { match: "Arsenal vs Chelsea", sport: "Football", time: "2026-11-20T18:00", note: "Watch the first half" };

function setup(raw = null) {
  const storage = {
    raw,
    getItem() { return this.raw; },
    setItem(key, value) { this.raw = value; }
  };
  function reload() {
    const context = { window: { localStorage: storage }, storageKeys: { schedule: "cyberWinSchedule" } };
    vm.runInNewContext(source, context);
    return context.window.matchStorage;
  }
  return { storage, reload, api: reload() };
}

test("create, restore, edit, clear note and delete persist across reloads", () => {
  const { api, reload } = setup();
  assert.equal(api.load().rows.length, 0);
  const id = api.add(entry).rows[0].id;
  assert.equal(reload().load().rows[0].note, entry.note);
  assert.equal(reload().update(id, { ...entry, match: "New match", note: "Updated note" }).error, undefined);
  assert.equal(reload().load().rows[0].match, "New match");
  assert.equal(reload().load().rows[0].note, "Updated note");
  reload().update(id, { ...entry, note: "" });
  assert.equal(reload().load().rows[0].note, "");
  reload().remove(id);
  assert.equal(reload().load().rows.length, 0);
});

test("malformed JSON and wrong root types can recover on next save", () => {
  for (const raw of ["{broken", "null", "42", "{}", '"text"']) {
    const { api } = setup(raw);
    assert.equal(api.load().rows.length, 0);
    assert.ok(api.load().warning);
    assert.equal(api.add(entry).rows.length, 1);
    assert.equal(api.load().warning, "");
  }
});

test("legacy rows survive, damaged rows are skipped and damaged notes are cleared", () => {
  const legacy = { ...entry };
  delete legacy.note;
  const { api, reload } = setup(JSON.stringify([
    null, 4, {}, { ...entry, time: "2026-02-30T10:00" }, legacy,
    { ...entry, note: {} }, { ...entry, id: "same" }, { ...entry, id: "same" }
  ]));
  const state = api.load();
  assert.equal(state.rows.length, 4);
  assert.ok(state.warning);
  assert.equal(state.rows[0].note, "");
  assert.equal(state.rows[1].note, "");
  assert.equal(new Set(state.rows.map(row => row.id)).size, 4);
  const id = state.rows[0].id;
  assert.equal(reload().load().rows[0].id, id);
  reload().update(id, { ...entry, note: "Legacy edited" });
  assert.equal(reload().load().rows[0].note, "Legacy edited");
});

test("write and read failures are reported without claiming success or losing stored data", () => {
  const { api, storage } = setup(JSON.stringify([{ ...entry, id: "existing" }]));
  const before = storage.raw;
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.ok(api.add(entry).error);
  assert.ok(api.update("existing", { ...entry, note: "new" }).error);
  assert.ok(api.remove("existing").error);
  assert.equal(storage.raw, before);
  storage.getItem = () => { throw new Error("SecurityError"); };
  assert.ok(api.load().error);
  assert.ok(api.add(entry).error);
  assert.equal(storage.raw, before);
});

test("invalid input and stale edits do not modify the schedule", () => {
  const { api, storage } = setup();
  for (const invalid of [
    { ...entry, match: " " }, { ...entry, match: "x".repeat(81) },
    { ...entry, time: "bad date" }, { ...entry, note: "x".repeat(1001) }
  ]) assert.ok(api.add(invalid).error);
  assert.equal(storage.raw, null);
  const id = api.add(entry).rows[0].id;
  api.remove(id);
  assert.ok(api.update(id, entry).error);
  assert.equal(api.load().rows.length, 0);
});
