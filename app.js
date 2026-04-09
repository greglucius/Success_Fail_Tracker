(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  const STORAGE_KEY = "accomplishments_tracker_data";

  function loadData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  let accomplishments = loadData();

  // ── DOM refs ───────────────────────────────────────────────────────
  const listEl = document.getElementById("accomplishments-list");
  const searchEl = document.getElementById("search");
  const filterCategoryEl = document.getElementById("filter-category");
  const filterImpactEl = document.getElementById("filter-impact");
  const filterYearEl = document.getElementById("filter-year");

  const modalForm = document.getElementById("modal-form");
  const modalExport = document.getElementById("modal-export");
  const modalStats = document.getElementById("modal-stats");
  const modalDelete = document.getElementById("modal-delete");

  const form = document.getElementById("accomplishment-form");
  const formId = document.getElementById("form-id");
  const formTitle = document.getElementById("form-title");
  const formDesc = document.getElementById("form-description");
  const formDate = document.getElementById("form-date");
  const formCategory = document.getElementById("form-category");
  const formImpact = document.getElementById("form-impact");
  const formTags = document.getElementById("form-tags");
  const modalTitleEl = document.getElementById("modal-title");

  const exportOutput = document.getElementById("export-output");
  const statsContent = document.getElementById("stats-content");

  let pendingDeleteId = null;

  // ── Helpers ────────────────────────────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function todayStr() {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }

  // ── Modal helpers ──────────────────────────────────────────────────
  function openModal(modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function closeAllModals() {
    [modalForm, modalExport, modalStats, modalDelete].forEach(closeModal);
  }

  // Close modals on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", closeAllModals);
  });

  // Close modals on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  // ── Year filter population ─────────────────────────────────────────
  function populateYearFilter() {
    const years = new Set(
      accomplishments.map((a) => new Date(a.date + "T00:00:00").getFullYear())
    );
    const currentVal = filterYearEl.value;
    filterYearEl.innerHTML = '<option value="">All Years</option>';
    [...years]
      .sort((a, b) => b - a)
      .forEach((y) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        filterYearEl.appendChild(opt);
      });
    filterYearEl.value = currentVal;
  }

  // ── Filtering ──────────────────────────────────────────────────────
  function getFiltered() {
    const query = searchEl.value.toLowerCase().trim();
    const cat = filterCategoryEl.value;
    const impact = filterImpactEl.value;
    const year = filterYearEl.value;

    return accomplishments
      .filter((a) => {
        if (cat && a.category !== cat) return false;
        if (impact && a.impact !== impact) return false;
        if (year && new Date(a.date + "T00:00:00").getFullYear() !== +year)
          return false;
        if (query) {
          const haystack = (
            a.title +
            " " +
            a.description +
            " " +
            (a.tags || []).join(" ")
          ).toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function renderList() {
    const filtered = getFiltered();

    if (filtered.length === 0) {
      const hasAny = accomplishments.length > 0;
      listEl.innerHTML = `
        <div class="empty-state">
          <p>${hasAny ? "No accomplishments match your filters." : "No accomplishments recorded yet."}</p>
          ${hasAny ? '<p>Try adjusting your search or filters.</p>' : "<p>Click <strong>+ Add Accomplishment</strong> to get started!</p>"}
        </div>`;
      return;
    }

    listEl.innerHTML = filtered.map((a) => {
      const tags = (a.tags || [])
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("");

      return `
        <div class="card impact-${a.impact.toLowerCase()}" data-id="${a.id}">
          <div class="card-header">
            <div class="card-title">${escapeHtml(a.title)}</div>
            <div class="card-actions">
              <button class="btn btn-secondary btn-small btn-edit" data-id="${a.id}">Edit</button>
              <button class="btn btn-secondary btn-small btn-delete" data-id="${a.id}">Delete</button>
            </div>
          </div>
          <div class="card-description">${escapeHtml(a.description)}</div>
          <div class="card-meta">
            <span class="badge badge-category">${escapeHtml(a.category)}</span>
            <span class="badge badge-impact-${a.impact.toLowerCase()}">${a.impact} Impact</span>
            <span class="card-date">${formatDate(a.date)}</span>
            ${tags ? `<div class="card-tags">${tags}</div>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  // ── CRUD ───────────────────────────────────────────────────────────
  function openAddForm() {
    formId.value = "";
    form.reset();
    formDate.value = todayStr();
    modalTitleEl.textContent = "Add Accomplishment";
    openModal(modalForm);
    formTitle.focus();
  }

  function openEditForm(id) {
    const item = accomplishments.find((a) => a.id === id);
    if (!item) return;

    formId.value = item.id;
    formTitle.value = item.title;
    formDesc.value = item.description;
    formDate.value = item.date;
    formCategory.value = item.category;
    formImpact.value = item.impact;
    formTags.value = (item.tags || []).join(", ");
    modalTitleEl.textContent = "Edit Accomplishment";
    openModal(modalForm);
    formTitle.focus();
  }

  function saveAccomplishment(e) {
    e.preventDefault();

    const tags = formTags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const entry = {
      id: formId.value || generateId(),
      title: formTitle.value.trim(),
      description: formDesc.value.trim(),
      date: formDate.value,
      category: formCategory.value,
      impact: formImpact.value,
      tags,
    };

    if (formId.value) {
      const idx = accomplishments.findIndex((a) => a.id === formId.value);
      if (idx !== -1) accomplishments[idx] = entry;
    } else {
      accomplishments.push(entry);
    }

    saveData(accomplishments);
    closeModal(modalForm);
    populateYearFilter();
    renderList();
  }

  function confirmDelete(id) {
    pendingDeleteId = id;
    openModal(modalDelete);
  }

  function executeDelete() {
    if (!pendingDeleteId) return;
    accomplishments = accomplishments.filter((a) => a.id !== pendingDeleteId);
    saveData(accomplishments);
    pendingDeleteId = null;
    closeModal(modalDelete);
    populateYearFilter();
    renderList();
  }

  // ── Export ─────────────────────────────────────────────────────────
  function generateExport(format) {
    const items = getFiltered();
    if (items.length === 0) return "No accomplishments to export.";

    if (format === "markdown") {
      return items
        .map((a) => {
          const tags =
            a.tags && a.tags.length ? `  Tags: ${a.tags.join(", ")}` : "";
          return `### ${a.title}\n**${formatDate(a.date)}** | ${a.category} | ${a.impact} Impact\n\n${a.description}${tags ? "\n\n" + tags : ""}`;
        })
        .join("\n\n---\n\n");
    }

    if (format === "plain") {
      return items
        .map((a) => {
          return `${a.title}\n${formatDate(a.date)} | ${a.category} | ${a.impact} Impact\n${a.description}`;
        })
        .join("\n\n" + "-".repeat(40) + "\n\n");
    }

    // Resume bullets
    return items
      .map((a) => {
        // Capitalize first letter of description
        const desc = a.description.charAt(0).toUpperCase() + a.description.slice(1);
        return `- ${desc} (${formatDate(a.date)})`;
      })
      .join("\n");
  }

  function openExport() {
    const format = document.querySelector(
      'input[name="export-format"]:checked'
    ).value;
    exportOutput.value = generateExport(format);
    openModal(modalExport);
  }

  function copyExport() {
    exportOutput.select();
    navigator.clipboard.writeText(exportOutput.value).then(() => {
      const btn = document.getElementById("btn-copy");
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = orig), 1500);
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────
  function openStats() {
    if (accomplishments.length === 0) {
      statsContent.innerHTML =
        '<p style="text-align:center;color:var(--color-text-secondary);padding:2rem">No accomplishments recorded yet.</p>';
      openModal(modalStats);
      return;
    }

    const currentYear = new Date().getFullYear();
    const thisYear = accomplishments.filter(
      (a) => new Date(a.date + "T00:00:00").getFullYear() === currentYear
    );
    const total = thisYear.length;
    const highCount = thisYear.filter((a) => a.impact === "High").length;
    const medCount = thisYear.filter((a) => a.impact === "Medium").length;
    const lowCount = thisYear.filter((a) => a.impact === "Low").length;

    // Category breakdown
    const catCounts = {};
    thisYear.forEach((a) => {
      catCounts[a.category] = (catCounts[a.category] || 0) + 1;
    });
    const maxCat = Math.max(...Object.values(catCounts), 1);
    const catRows = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([cat, count]) => `
        <div class="breakdown-row">
          <span>${escapeHtml(cat)}</span>
          <span>${count}</span>
        </div>
        <div class="breakdown-bar">
          <div class="breakdown-fill" style="width:${(count / maxCat) * 100}%"></div>
        </div>`
      )
      .join("");

    // Monthly breakdown
    const months = Array(12).fill(0);
    thisYear.forEach((a) => {
      const m = new Date(a.date + "T00:00:00").getMonth();
      months[m]++;
    });
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const maxMonth = Math.max(...months, 1);
    const monthRows = months
      .map(
        (count, i) => `
        <div class="breakdown-row">
          <span>${monthNames[i]}</span>
          <span>${count}</span>
        </div>
        <div class="breakdown-bar">
          <div class="breakdown-fill" style="width:${(count / maxMonth) * 100}%"></div>
        </div>`
      )
      .join("");

    statsContent.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${total}</div>
          <div class="stat-label">Total (${currentYear})</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--color-high)">${highCount}</div>
          <div class="stat-label">High Impact</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--color-medium)">${medCount}</div>
          <div class="stat-label">Medium Impact</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--color-low)">${lowCount}</div>
          <div class="stat-label">Low Impact</div>
        </div>
      </div>
      <div class="stats-breakdown">
        <h3>By Category</h3>
        ${catRows || "<p>No data</p>"}
      </div>
      <div class="stats-breakdown">
        <h3>By Month</h3>
        ${monthRows}
      </div>
      <div class="stats-breakdown" style="margin-top:1rem">
        <h3>All-Time Total</h3>
        <div class="stat-card">
          <div class="stat-number">${accomplishments.length}</div>
          <div class="stat-label">Accomplishments Recorded</div>
        </div>
      </div>`;

    openModal(modalStats);
  }

  // ── Event wiring ───────────────────────────────────────────────────
  document.getElementById("btn-add").addEventListener("click", openAddForm);
  document.getElementById("btn-export").addEventListener("click", openExport);
  document.getElementById("btn-stats").addEventListener("click", openStats);
  document.getElementById("btn-cancel").addEventListener("click", () => closeModal(modalForm));
  document.getElementById("btn-export-close").addEventListener("click", () => closeModal(modalExport));
  document.getElementById("btn-stats-close").addEventListener("click", () => closeModal(modalStats));
  document.getElementById("btn-delete-cancel").addEventListener("click", () => closeModal(modalDelete));
  document.getElementById("btn-delete-confirm").addEventListener("click", executeDelete);
  document.getElementById("btn-copy").addEventListener("click", copyExport);

  form.addEventListener("submit", saveAccomplishment);

  // Export format radio change
  document.querySelectorAll('input[name="export-format"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      exportOutput.value = generateExport(radio.value);
    });
  });

  // Delegated click for edit/delete buttons on cards
  listEl.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    const deleteBtn = e.target.closest(".btn-delete");
    if (editBtn) openEditForm(editBtn.dataset.id);
    if (deleteBtn) confirmDelete(deleteBtn.dataset.id);
  });

  // Live filtering
  searchEl.addEventListener("input", renderList);
  filterCategoryEl.addEventListener("change", renderList);
  filterImpactEl.addEventListener("change", renderList);
  filterYearEl.addEventListener("change", renderList);

  // ── Init ───────────────────────────────────────────────────────────
  populateYearFilter();
  renderList();
})();
