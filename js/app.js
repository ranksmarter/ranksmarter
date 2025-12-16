// app.js (classic script, no imports)

(function () {
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.classList.remove("hidden"); }
  function hide(el) { if (el) el.classList.add("hidden"); }
  function exists(x) { return !!x; }

  const fileInput = $("fileInput");
  const uploadStatus = $("uploadStatus");

  const controls = $("controls");
  const kInput = $("kInput");
  const kHint = $("kHint");

  const epsInput = $("epsInput");
  const epsValue = $("epsValue");

  const runAnalysisBtn = $("runAnalysis");
  const runMcBtn = $("runMc");

  const verdict = $("verdict");
  const verdictPill = $("verdictPill");
  const verdictText = $("verdictText");
  const actionText = $("actionText");
  const whyText = $("whyText");

  const details = $("details");
  const boundaryTable = $("boundaryTable");
  const tieBandBox = $("tieBandBox");
  const previewTable = $("previewTable");

  const exportJsonBtn = $("exportJson");
  const exportMarkdownBtn = $("exportMarkdown");

  const mcEnable = $("mcEnable");
  const mcSamples = $("mcSamples");
  const mcSeed = $("mcSeed");
  const mcBlock = $("mcBlock");
  const mcSummary = $("mcSummary");
  const mcTable = $("mcTable");

  const openMath = $("openMath");
  const openMathHero = $("openMathHero");
  const mathModal = $("mathModal");

  const openGuide = $("openGuide");
  const guideModal = $("guideModal");

  const loadDemo = $("loadDemo");
  const jumpUpload = $("jumpUpload");
  const uploadCard = $("uploadCard");

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
        } else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { res.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    res.push(cur);
    return res;
  }

  function parseCSV(text) {
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

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "false");
    modalEl.classList.remove("hidden");
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.classList.add("hidden");
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

  // Monte Carlo toggle
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

      uploadStatus.textContent =
        `Loaded ${data.length} valid rows. Next: set how many you are selecting, and the maximum scoring error you think is plausible.`;

      setControlsForData();

      // reset outputs
      hide(verdict);
      hide(details);
      lastResult = null;
      lastMc = null;
      hide(mcBlock);

      controls.scrollIntoView({ behavior: "smooth", block: "start" });
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

      uploadStatus.textContent =
        `Loaded demo data (${data.length} rows). Next: set selection size and plausible scoring error.`;

      setControlsForData();

      hide(verdict);
      hide(details);
      lastResult = null;
      lastMc = null;
      hide(mcBlock);

      controls.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      uploadStatus.textContent = "Could not load demo. Ensure assets/example.csv exists.";
    }
  });

  function setPill(text, kind) {
    verdictPill.textContent = text;
    verdictPill.classList.remove("pill-good", "pill-warn", "pill-bad");
    if (kind) verdictPill.classList.add(kind);
  }

  function runAnalysis() {
    if (!data.length) return;
    if (!window.RankSmarterAnalyze) throw new Error("RankSmarterAnalyze not found. Check js/analysis.js is loaded.");

    const k = Number(kInput.value || 1);
    const eps = Number(epsInput.value || 0);

    const result = window.RankSmarterAnalyze(data, k, eps);
    lastResult = result;
    lastMc = null;
    hide(mcBlock);

    const fmt = result.fmt;
    const b = result.boundary;
    const r = result.regions;
    const s = result.suggestions;

    show(verdict);
    show(details);

    const n = result.meta.n;

    if (r.tieBand && r.tieBand.spansBoundary) {
      // Main “real world” output
      setPill("Boundary is a tie band", "pill-warn");

      const L = r.tieBand.loRank;
      const U = r.tieBand.hiRank;

      verdictText.textContent =
        `At ±${fmt(result.meta.eps)} scoring uncertainty, your cutoff at top ${result.meta.k} falls inside a near-tie. ` +
        `Ranks ${L} to ${U} are mathematically indistinguishable under that error bound.`;

      const parts = [];
      if (r.guaranteedIn.toRank >= 1) parts.push(`Guaranteed in: ranks 1 to ${r.guaranteedIn.toRank}.`);
      parts.push(`Tie band: ranks ${L} to ${U}.`);
      if (r.guaranteedOut.fromRank <= n) parts.push(`Guaranteed out: ranks ${r.guaranteedOut.fromRank} to ${n}.`);

      actionText.textContent =
        `${parts.join(" ")} If you need a single hard cutoff, pick either conservative (top ${s.conservativeCutoffK}) or inclusive (top ${s.inclusiveCutoffK}), then use a secondary criterion inside the tie band.`;

      whyText.textContent =
        `This is not preference. With your wiggle room, the ordering inside the tie band can flip. ` +
        `A guaranteed strict cutoff at the boundary would require scoring accuracy of about ±${fmt(b.requiredEpsForGuarantee)} at ranks ${result.meta.k} and ${result.meta.k + 1}.`;
    } else {
      // Stable case
      setPill("Cutoff is defensible", "pill-good");

      verdictText.textContent =
        `With ±${fmt(result.meta.eps)} scoring uncertainty, selecting the top ${result.meta.k} is stable at the boundary.`;

      actionText.textContent =
        `Recommendation: keep a strict cutoff at ${result.meta.k}.`;

      whyText.textContent =
        `To guarantee the boundary never flips, scoring would need to be accurate within about ±${fmt(b.requiredEpsForGuarantee)} at the cutoff pair. ` +
        `You assumed ±${fmt(result.meta.eps)}.`;
    }

    // Evidence table
    renderTable(boundaryTable,
      ["Field", "Value"],
      [
        ["Chosen selection size (N)", `${result.meta.k}`],
        ["Boundary items", `Rank ${result.meta.k}: ${escapeHtml(b.insideItem)} vs Rank ${result.meta.k + 1}: ${escapeHtml(b.outsideItem)}`],
        ["Boundary scores", `${b.insideScore} vs ${b.outsideScore}`],
        ["Gap at boundary", fmt(b.gap)],
        ["Accuracy required for guaranteed cutoff", `±${fmt(b.requiredEpsForGuarantee)}`],
        ["Your wiggle room", `±${fmt(result.meta.eps)}`]
      ]
    );

    // Tie band box
    if (r.tieBand && r.tieBand.spansBoundary) {
      tieBandBox.innerHTML =
        `Treat ranks <strong>${r.tieBand.loRank}</strong> to <strong>${r.tieBand.hiRank}</strong> as a tie band. ` +
        `That means a strict cutoff inside this range is not defensible under your stated uncertainty. ` +
        `Use a secondary criterion (extra interview, reference check, cost-risk review, or domain-specific metric) to decide within the band.`;
    } else {
      tieBandBox.textContent =
        "No tie band at this wiggle room. The boundary gap is larger than the error bound, so the cutoff is stable under this model.";
    }

    // Preview
    const maxRows = Math.min(20, result.sorted.length);
    const tbLo = r.tieBand ? r.tieBand.loRank : null;
    const tbHi = r.tieBand ? r.tieBand.hiRank : null;

    const preview = result.sorted.slice(0, maxRows).map((row, i) => {
      const rank = i + 1;
      const isBoundary = (rank === result.meta.k || rank === result.meta.k + 1);
      const isTie = (tbLo !== null && rank >= tbLo && rank <= tbHi);

      const rankCell = isBoundary ? `<strong>${rank}</strong>` : `${rank}`;
      const itemCell = isBoundary ? `<strong>${escapeHtml(row.item)}</strong>` : escapeHtml(row.item);
      const scoreCell = isBoundary ? `<strong>${row.score}</strong>` : `${row.score}`;
      const tag = isTie ? ` <span class="tag">tie band</span>` : "";

      return [rankCell, itemCell, scoreCell + tag];
    });

    renderTable(previewTable, ["Rank", "Item", "Score"], preview);

    // exports
    exportJsonBtn.disabled = !exists(window.RankSmarterExportJSON);
    exportMarkdownBtn.disabled = !exists(window.RankSmarterExportMarkdown);
  }

  runAnalysisBtn.addEventListener("click", () => {
    try { runAnalysis(); }
    catch (err) { alert(err && err.message ? err.message : String(err)); }
  });

  runMcBtn.addEventListener("click", () => {
    try {
      if (!window.RankSmarterMonteCarlo) {
        alert("Monte Carlo module not loaded. Check js/montecarlo.js is included.");
        return;
      }

      if (!lastResult) runAnalysis();
      if (!lastResult) return;

      const eps = Number(epsInput.value || 0);
      const k = Number(kInput.value || 1);
      const samples = Math.max(200, Math.min(20000, Number(mcSamples.value || 2000)));
      const seed = Math.max(0, Math.min(999999999, Number(mcSeed.value || 12345)));

      const mc = window.RankSmarterMonteCarlo(lastResult.sorted, k, eps, samples, seed);
      lastMc = mc;

      show(mcBlock);

      // Improved, plain-English messaging
      const unchangedPct = (mc.sameSetProb * 100).toFixed(1);
      const avgOverlapPct = (mc.avgOverlapFrac * 100).toFixed(1);
      const avgOverlapCount = Math.round(mc.avgOverlapFrac * k);

      mcSummary.textContent =
        `Stability check: if the scores were slightly wrong (within your wiggle room), you would pick ` +
        `exactly the same set ${unchangedPct}% of the time. On average, ${avgOverlapCount} out of ${k} ` +
        `selected items stay the same (≈${avgOverlapPct}% overlap).`;

      const rows = (mc.inclusionTop || []).map(x => [
        escapeHtml(x.item),
        (x.prob * 100).toFixed(1) + "%"
      ]);

      // Improved table header label
      renderTable(mcTable, ["Item", "Chance of being selected"], rows);
    } catch (err) {
      alert(err && err.message ? err.message : String(err));
    }
  });

  exportJsonBtn.addEventListener("click", () => {
    if (!lastResult) return;
    if (!window.RankSmarterExportJSON) { alert("Export JSON module not loaded."); return; }
    window.RankSmarterExportJSON(lastResult, lastMc);
  });

  exportMarkdownBtn.addEventListener("click", () => {
    if (!lastResult) return;
    if (!window.RankSmarterExportMarkdown) { alert("Export report module not loaded."); return; }
    window.RankSmarterExportMarkdown(lastResult, lastMc);
  });

  exportJsonBtn.disabled = true;
  exportMarkdownBtn.disabled = true;
})();
