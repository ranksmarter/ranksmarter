// app.js (classic script, no imports)

(function () {
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");

  const controls = document.getElementById("controls");
  const kInput = document.getElementById("kInput");
  const kHint = document.getElementById("kHint");

  const epsInput = document.getElementById("epsInput");
  const epsValue = document.getElementById("epsValue");

  const runAnalysisBtn = document.getElementById("runAnalysis");
  const runMcBtn = document.getElementById("runMc");

  const verdict = document.getElementById("verdict");
  const verdictPill = document.getElementById("verdictPill");
  const verdictText = document.getElementById("verdictText");
  const actionText = document.getElementById("actionText");
  const whyText = document.getElementById("whyText");

  const details = document.getElementById("details");
  const boundaryTable = document.getElementById("boundaryTable");
  const tieBandBox = document.getElementById("tieBandBox");
  const previewTable = document.getElementById("previewTable");

  const exportJsonBtn = document.getElementById("exportJson");
  const exportMarkdownBtn = document.getElementById("exportMarkdown");

  const mcEnable = document.getElementById("mcEnable");
  const mcSamples = document.getElementById("mcSamples");
  const mcSeed = document.getElementById("mcSeed");
  const mcBlock = document.getElementById("mcBlock");
  const mcSummary = document.getElementById("mcSummary");
  const mcTable = document.getElementById("mcTable");

  const openMath = document.getElementById("openMath");
  const openMathHero = document.getElementById("openMathHero");
  const mathModal = document.getElementById("mathModal");

  const openGuide = document.getElementById("openGuide");
  const guideModal = document.getElementById("guideModal");

  const loadDemo = document.getElementById("loadDemo");
  const jumpUpload = document.getElementById("jumpUpload");
  const uploadCard = document.getElementById("uploadCard");

  let data = [];
  let lastResult = null;
  let lastMc = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderTable(container, headers, rows) {
    const h = headers.map(x => `<th>${escapeHtml(x)}</th>`).join("");
    const b = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
    container.innerHTML = `<table><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table>`;
  }

  function parseCSV(text) {
    // simple CSV: supports quoted fields minimally
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) throw new Error("CSV must include a header row and at least one data row.");

    const header = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const itemIdx = header.indexOf("item") !== -1 ? header.indexOf("item") : header.indexOf("name");
    const scoreIdx = header.indexOf("score") !== -1 ? header.indexOf("score") : header.indexOf("value");

    if (itemIdx === -1 || scoreIdx === -1) {
      throw new Error("CSV must have columns named item (or name) and score (or value).");
    }

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      const item = (cols[itemIdx] || "").trim();
      const score = Number(String(cols[scoreIdx] || "").trim());
      if (!item) continue;
      if (!Number.isFinite(score)) continue;
      out.push({ item, score });
    }

    if (out.length < 2) throw new Error("Need at least two valid rows with item and numeric score.");
    return out;
  }

  function splitCSVLine(line) {
    const res = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { res.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    res.push(cur);
    return res;
  }

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "false");
    show(modalEl);
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "true");
    hide(modalEl);
  }

  function wireModal(modalEl, openEls, closeSelector) {
    if (!modalEl) return;

    // ensure closed on load
    closeModal(modalEl);

    for (const el of openEls) {
      if (!el) continue;
      el.addEventListener("click", (e) => { e.preventDefault(); openModal(modalEl); });
    }

    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) closeModal(modalEl);
    });

    const closeBtn = modalEl.querySelector(closeSelector);
    if (closeBtn) closeBtn.addEventListener("click", () => closeModal(modalEl));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal(modalEl);
    });
  }

  wireModal(mathModal, [openMath, openMathHero], ".closeModal");
  wireModal(guideModal, [openGuide], ".closeGuide");

  if (jumpUpload && uploadCard && fileInput) {
    jumpUpload.addEventListener("click", () => {
      uploadCard.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => fileInput.click(), 250);
    });
  }

  function setControlsForData() {
    const n = data.length;
    show(controls);

    const maxK = Math.max(1, n - 1);
    kInput.max = String(maxK);

    const defaultK = Math.min(5, maxK);
    if (!kInput.value) kInput.value = String(defaultK);

    kHint.textContent = `You have ${n} items. Valid cutoff is 1 to ${maxK}.`;

    epsValue.textContent = Number(epsInput.value || 0).toFixed(2);
  }

  epsInput.addEventListener("input", () => {
    epsValue.textContent = Number(epsInput.value || 0).toFixed(2);
  });

  mcEnable.addEventListener("change", () => {
    const enabled = mcEnable.checked;
    mcSamples.disabled = !enabled;
    mcSeed.disabled = !enabled;
    runMcBtn.disabled = !enabled;
    if (!enabled) {
      hide(mcBlock);
      lastMc = null;
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    try {
      const text = await f.text();
      data = parseCSV(text);
      uploadStatus.textContent = `Loaded ${data.length} valid rows. Choose cutoff and wiggle room below.`;
      setControlsForData();

      // reset outputs
      hide(verdict);
      hide(details);
      lastResult = null;
      lastMc = null;
      hide(mcBlock);
    } catch (err) {
      uploadStatus.textContent = err && err.message ? err.message : String(err);
      data = [];
      hide(controls);
      hide(verdict);
      hide(details);
    }
  });

  loadDemo.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch("assets/example.csv", { cache: "no-store" });
      const text = await resp.text();
      data = parseCSV(text);
      uploadStatus.textContent = `Loaded demo data (${data.length} rows). Choose cutoff and wiggle room below.`;
      setControlsForData();
      hide(verdict);
      hide(details);
      lastResult = null;
      lastMc = null;
      hide(mcBlock);

      // scroll user into the next step
      controls.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      uploadStatus.textContent = "Could not load demo. Ensure assets/example.csv exists.";
    }
  });

  function runAnalysis() {
    if (!data.length) return;

    const k = Number(kInput.value || 1);
    const eps = Number(epsInput.value || 0);

    const result = window.RankSmarterAnalyze(data, k, eps);
    lastResult = result;
    lastMc = null;
    hide(mcBlock);

    const b = result.boundary;
    const fmt = result.fmt;

    show(verdict);
    show(details);

    if (result.stable) {
      verdictPill.textContent = "Defensible cutoff";
      verdictText.textContent = `Selecting top ${result.meta.k} is defensible at the stated wiggle room.`;
      actionText.textContent = `Proceed with a strict cutoff at ${result.meta.k}.`;
      whyText.textContent = `Forced accuracy required to prevent a flip at the boundary is about ±${fmt(b.required)}. Your wiggle room is ±${fmt(result.meta.eps)}.`;
    } else {
      verdictPill.textContent = "Likely fake precision";
      verdictText.textContent = `A strict cutoff at ${result.meta.k} is not defensible at the stated wiggle room.`;
      if (result.band) {
        actionText.textContent = `Treat ranks ${result.band.loRank} to ${result.band.hiRank} as a tie band.`;
      } else {
        actionText.textContent = "Treat the boundary as a tie band or improve scoring precision before cutting.";
      }
      whyText.textContent = `Forced accuracy required to prevent a flip at the boundary is ±${fmt(b.required)}. Your wiggle room is ±${fmt(result.meta.eps)}.`;
    }

    renderTable(boundaryTable,
      ["Field", "Value"],
      [
        ["Inside (rank N)", `${escapeHtml(b.insideItem)} = ${b.insideScore}`],
        ["Outside (rank N+1)", `${escapeHtml(b.outsideItem)} = ${b.outsideScore}`],
        ["Gap", fmt(b.gap)],
        ["Forced accuracy required", `±${fmt(b.required)}`]
      ]
    );

    if (result.band) {
      tieBandBox.innerHTML =
        `At this wiggle room, the cutoff sits inside a near-tie. Treat ranks <strong>${result.band.loRank}</strong> to <strong>${result.band.hiRank}</strong> as a tie band, then use a secondary criterion or additional evaluation.`;
    } else {
      tieBandBox.textContent =
        "No tie band around the cutoff at this wiggle room. The boundary gap is larger than the error bound.";
    }

    const preview = result.sorted.slice(0, Math.min(20, result.sorted.length)).map((r, i) => {
      const rank = i + 1;
      const isBoundary = rank === result.meta.k || rank === result.meta.k + 1;
      return [
        isBoundary ? `<strong>${rank}</strong>` : `${rank}`,
        isBoundary ? `<strong>${escapeHtml(r.item)}</strong>` : escapeHtml(r.item),
        isBoundary ? `<strong>${r.score}</strong>` : `${r.score}`
      ];
    });

    renderTable(previewTable, ["Rank", "Item", "Score"], preview);

    // enable exports
    exportJsonBtn.disabled = false;
    exportMarkdownBtn.disabled = false;
  }

  runAnalysisBtn.addEventListener("click", () => {
    try { runAnalysis(); } catch (err) { alert(err && err.message ? err.message : String(err)); }
  });

  runMcBtn.addEventListener("click", () => {
    if (!lastResult) runAnalysis();
    if (!lastResult) return;

    const eps = Number(epsInput.value || 0);
    const k = Number(kInput.value || 1);
    const samples = Math.max(200, Math.min(20000, Number(mcSamples.value || 2000)));
    const seed = Math.max(0, Math.min(999999999, Number(mcSeed.value || 12345)));

    const mc = window.RankSmarterMonteCarlo(lastResult.sorted, k, eps, samples, seed);
    lastMc = mc;

    show(mcBlock);

    mcSummary.textContent =
      `Selected set unchanged in ${(mc.sameSetProb * 100).toFixed(1)}% of trials. Average overlap is ${(mc.avgOverlapFrac * 100).toFixed(1)}%.`;

    const rows = mc.inclusionTop.map(x => [
      escapeHtml(x.item),
      (x.prob * 100).toFixed(1) + "%"
    ]);

    renderTable(mcTable, ["Item", "P(in selected set)"], rows);
  });

  exportJsonBtn.addEventListener("click", () => {
    if (!lastResult) return;
    window.RankSmarterExportJSON(lastResult, lastMc);
  });

  exportMarkdownBtn.addEventListener("click", () => {
    if (!lastResult) return;
    window.RankSmarterExportMarkdown(lastResult, lastMc);
  });

  // Disable export until there is a result
  exportJsonBtn.disabled = true;
  exportMarkdownBtn.disabled = true;
})();
