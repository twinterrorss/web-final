(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".schedule-form");
    if (!form) return;
    const body = document.querySelector(".schedule-table tbody");
    const message = document.getElementById("schedule-message");
    const cancel = document.getElementById("cancel-schedule");
    const submit = form.querySelector('[type="submit"]');
    let editingId = null;

    function notify(text, error) {
      message.textContent = text || "";
      message.className = "schedule-message " + (error ? "text-warning" : "text-success");
    }

    function render() {
      const state = window.matchStorage.load();
      body.replaceChildren();
      state.rows.forEach(function (row) {
        const tr = document.createElement("tr");
        [row.match, row.sport, new Date(row.time).toLocaleString(), row.note || "—"].forEach(function (text, index) {
          const cell = document.createElement(index === 0 ? "th" : "td");
          if (index === 0) cell.scope = "row";
          if (index === 3) cell.className = "match-note";
          cell.textContent = text;
          tr.append(cell);
        });
        const actions = document.createElement("td");
        ["Edit", "Delete"].forEach(function (label) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "btn btn-sm " + (label === "Edit" ? "btn-outline-success me-2" : "btn-outline-danger");
          button.textContent = label;
          button.dataset.id = row.id;
          button.dataset.action = label.toLowerCase();
          button.setAttribute("aria-label", label + " " + row.match);
          actions.append(button);
        });
        tr.append(actions);
        body.append(tr);
      });
      if (!state.rows.length) {
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = state.error ? "Saved schedule could not be loaded." : "No saved matches yet. Add your first match above.";
        const tr = document.createElement("tr");
        tr.append(cell);
        body.append(tr);
      }
      if (state.error || state.warning) notify(state.error || state.warning, true);
    }

    function resetForm() {
      editingId = null;
      form.reset();
      submit.textContent = "ADD MATCH";
      document.getElementById("schedule-form-title").textContent = "Plan a match viewing";
      cancel.hidden = true;
    }

    cancel.addEventListener("click", function () {
      resetForm();
      notify("");
      form.elements.match.focus();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const entry = {
        match: form.elements.match.value.trim(),
        sport: form.elements.sport.value,
        time: form.elements.time.value,
        note: form.elements.note.value.trim()
      };
      const wasEditing = editingId !== null;
      const result = wasEditing ? window.matchStorage.update(editingId, entry) : window.matchStorage.add(entry);
      if (result.error) return notify(result.error, true);
      resetForm();
      render();
      notify(wasEditing ? "Match and note updated." : "Match saved to your schedule.");
    });

    body.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "delete") {
        const result = window.matchStorage.remove(id);
        if (result.error) return notify(result.error, true);
        if (editingId === id) resetForm();
        render();
        notify("Match and note deleted.");
        form.elements.match.focus();
        return;
      }
      const state = window.matchStorage.load();
      if (state.error) return notify(state.error, true);
      const row = state.rows.find(function (entry) { return entry.id === id; });
      if (!row) {
        render();
        return notify("This match no longer exists.", true);
      }
      editingId = id;
      form.elements.match.value = row.match;
      const sport = form.elements.sport;
      if (!Array.from(sport.options).some(function (option) { return option.value === row.sport; })) {
        sport.add(new Option(row.sport, row.sport));
      }
      sport.value = row.sport;
      const date = new Date(row.time);
      const pad = function (value) { return String(value).padStart(2, "0"); };
      form.elements.time.value = date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
        "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
      form.elements.note.value = row.note;
      submit.textContent = "SAVE CHANGES";
      document.getElementById("schedule-form-title").textContent = "Edit match and note";
      cancel.hidden = false;
      notify("");
      form.elements.match.focus();
    });

    window.addEventListener("schedule-changed", function () {
      render();
      notify("Match saved to your schedule. Use Edit to add a note.");
    });
    window.addEventListener("storage", function (event) {
      if (event.key === storageKeys.schedule || event.key === null) {
        notify("Schedule updated in another tab. Unsaved form changes have been kept.");
        render();
      }
    });
    render();
  });
})();
