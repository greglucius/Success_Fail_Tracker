(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  const STORAGE_KEY = "accomplishments_tracker_data";
  const THEME_KEY = "accomplishments_tracker_theme";

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
  const resultsCountEl = document.getElementById("results-count");

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
  const toastContainer = document.getElementById("toast-container");

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

  // ── Theme ──────────────────────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  initTheme();

  // ── Toast Notifications ────────────────────────────────────────────
  function showToast(message, type = "success") {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>',
      danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || ""}${escapeHtml(message)}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("removing");
      toast.addEventListener("animationend", () => toast.remove());
    }, 2500);
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

  // Close modals via X button
  document.querySelectorAll(".btn-modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      const modal = document.getElementById(modalId);
      if (modal) closeModal(modal);
    });
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

  // ── Results count ──────────────────────────────────────────────────
  function updateResultsCount(filtered) {
    if (accomplishments.length === 0) {
      resultsCountEl.textContent = "";
      return;
    }
    const total = accomplishments.length;
    const shown = filtered.length;
    if (shown === total) {
      resultsCountEl.textContent = `${total} accomplishment${total !== 1 ? "s" : ""}`;
    } else {
      resultsCountEl.textContent = `Showing ${shown} of ${total} accomplishment${total !== 1 ? "s" : ""}`;
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function renderList() {
    const filtered = getFiltered();
    updateResultsCount(filtered);

    if (filtered.length === 0) {
      const hasAny = accomplishments.length > 0;
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="64" height="64">
              ${hasAny
                ? '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
                : '<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>'
              }
            </svg>
          </div>
          <p class="empty-title">${hasAny ? "No accomplishments match your filters" : "No accomplishments recorded yet"}</p>
          <p class="empty-subtitle">${hasAny ? "Try adjusting your search or filters." : 'Click <strong>+ Add Accomplishment</strong> to start tracking your wins!'}</p>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((a) => {
        const tags = (a.tags || [])
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("");

        return `
        <div class="card impact-${a.impact.toLowerCase()}" data-id="${a.id}">
          <div class="card-header">
            <div class="card-title">${escapeHtml(a.title)}</div>
            <div class="card-actions">
              <button class="btn btn-ghost btn-small btn-edit" data-id="${a.id}">Edit</button>
              <button class="btn btn-ghost btn-small btn-delete" data-id="${a.id}">Delete</button>
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
      })
      .join("");
  }

  // ── CRUD ───────────────────────────────────────────────────────────
  function openAddForm() {
    formId.value = "";
    form.reset();
    formDate.value = todayStr();
    modalTitleEl.textContent = "Add Accomplishment";
    openModal(modalForm);
    setTimeout(() => formTitle.focus(), 50);
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
    setTimeout(() => formTitle.focus(), 50);
  }

  function saveAccomplishment(e) {
    e.preventDefault();

    const tags = formTags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const isEdit = !!formId.value;

    const entry = {
      id: formId.value || generateId(),
      title: formTitle.value.trim(),
      description: formDesc.value.trim(),
      date: formDate.value,
      category: formCategory.value,
      impact: formImpact.value,
      tags,
    };

    if (isEdit) {
      const idx = accomplishments.findIndex((a) => a.id === formId.value);
      if (idx !== -1) accomplishments[idx] = entry;
    } else {
      accomplishments.push(entry);
    }

    saveData(accomplishments);
    closeModal(modalForm);
    populateYearFilter();
    renderList();
    showToast(
      isEdit ? "Accomplishment updated!" : "Accomplishment saved!",
      "success"
    );
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
    showToast("Accomplishment deleted", "danger");
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
        const desc =
          a.description.charAt(0).toUpperCase() + a.description.slice(1);
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
      showToast("Copied to clipboard!", "info");
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────
  function openStats() {
    if (accomplishments.length === 0) {
      statsContent.innerHTML = `
        <div class="empty-state" style="border:none;padding:3rem 2rem">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <p class="empty-title">No data yet</p>
          <p class="empty-subtitle">Add some accomplishments to see your year summary.</p>
        </div>`;
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
          <span style="font-weight:700">${count}</span>
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
          <span style="font-weight:700">${count}</span>
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
        ${catRows || '<p style="color:var(--color-text-tertiary)">No data</p>'}
      </div>
      <div class="stats-breakdown">
        <h3>By Month</h3>
        ${monthRows}
      </div>
      <div class="stats-breakdown">
        <h3>All Time</h3>
        <div class="stat-card" style="margin-top:0.5rem">
          <div class="stat-number">${accomplishments.length}</div>
          <div class="stat-label">Total Accomplishments</div>
        </div>
      </div>`;

    openModal(modalStats);
  }

  // ── Event wiring ───────────────────────────────────────────────────
  document.getElementById("btn-add").addEventListener("click", openAddForm);
  document.getElementById("btn-export").addEventListener("click", openExport);
  document.getElementById("btn-stats").addEventListener("click", openStats);
  document.getElementById("btn-theme").addEventListener("click", toggleTheme);
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
