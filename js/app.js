// app.js (classic script, no imports)
// Expects globals:
// - window.RankSmarterAnalyze(data, k, eps)
// - window.RankSmarterMonteCarlo(sorted, k, eps, samples, seed)   (optional)
// - window.RankSmarterExportJSON(result, mc)                      (optional)
// - window.RankSmarterExportMarkdown(result, mc)                  (optional)

(function () {
  // ---------- Safe DOM helpers ----------
  function $(id) { return document.getElementById(id); }
  function exists(el) { return !!el; }
  function show(el) { if (el) el.classList.remove("hidden"); }
  function hide(el) { if (el) el.classList.add("hidden"); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderTable(container, headers, rows) {
    if (!container) return;
    const h = headers.map(x => `<th>${escapeHtml(x)}</th>`).join("");
    const b = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
    container.innerHTML = `<table><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table>`;
  }

  // ---------- Elements (may vary by your index.html) ----------
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

  // ---------- State ----------
  let data = [];
  let lastResult = null;
  let lastMc = null;

  // ---------- CSV parsing ----------
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

  // ---------- Modals ----------
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

    // Ensure closed on load
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

  // ---------- Upload jump ----------
  if (jumpUpload && uploadCard && fileInput) {
    jumpUpload.addEventListener("click", () => {
      uploadCard.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => fileInput.click(), 250);
    });
  }

  // ---------- Controls ----------
  function setControlsForData() {
    if (!controls || !kInput || !epsInput) return;

    const n = data.length;
    show(controls);

    const maxK = Math.max(1, n - 1);
    kInput.max = String(maxK);

    const defaultK = Math.min(5, maxK);
    if (!kInput.value) kInput.value = String(defaultK);

    if (kHint) kHint.textContent = `You have ${n} items. Valid selection size is 1 to ${maxK}.`;

    if (epsValue) epsValue.textContent = Number(epsInput.value || 0).toFixed(2);
  }

  if (epsInput && epsValue) {
    epsInput.addEventListener("input", () => {
      epsValue.textContent = Number(epsInput.value || 0).toFixed(2);
    });
  }

  // Monte Carlo enable block (optional UI)
  if (mcEnable) {
    mcEnable.addEventListener("change", () => {
      const enabled = mcEnable.checked;
      if (mcSamples) mcSamples.disabled = !enabled;
      if (mcSeed) mcSeed.disabled = !enabled;
      if (runMcBtn) runMcBtn.disabled = !enabled;
      if (!enabled) {
        hide(mcBlock);
        lastMc = null;
      }
    });
  }

  // ---------- File load ----------
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;

      try {
        const text = await f.text();
        data = parseCSV(text);

        if (uploadStatus) {
          uploadStatus.textContent = `Loaded ${data.length} valid rows. Now set how many you are selecting, and the plausible scoring uncertainty.`;
        }

        setControlsForData();

        // reset outputs
        hide(verdict);
        hide(details);
        lastResult = null;
        lastMc = null;
        hide(mcBlock);

        // scroll user into step 2
        if (controls) controls.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        if (uploadStatus) uploadStatus.textContent = err && err.message ? err.message : String(err);
        data = [];
        hide(controls);
        hide(verdict);
        hide(details);
      }
    });
  }

  // Demo load
  if (loadDemo) {
    loadDemo.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const resp = await fetch("assets/example.csv", { cache: "no-store" });
        const text = await resp.text();
        data = parseCSV(text);

        if (uploadStatus) {
          uploadStatus.textContent = `Loaded demo data (${data.length} rows). Now set how many you are selecting, and the plausible scoring uncertainty.`;
        }

        setControlsForData();
        hide(verdict);
        hide(details);
        lastResult = null;
        lastMc = null;
        hide(mcBlock);

        if (controls) controls.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        if (uploadStatus) uploadStatus.textContent = "Could not load demo. Ensure assets/example.csv exists.";
      }
    });
  }

  // ---------- Core messaging helpers ----------
  function setVerdictPill(text, kind) {
    if (!verdictPill) return;
    verdictPill.textContent = text;

    // Optional: if your CSS uses classes for styling, preserve compatibility:
    verdictPill.classList.remove("pill-good", "pill-warn", "pill-bad");
    if (kind) verdictPill.classList.add(kind);
  }

  function humanWiggleExplanation(eps) {
    // Keep it short and practical
    return `Your “wiggle room” is the largest scoring error you think is plausible in this process (for example: rater disagreement, criteria interpretation, or estimation noise).`;
  }

  // ---------- Run analysis ----------
  function runAnalysis() {
    if (!data.length) return;
    if (!window.RankSmarterAnalyze) throw new Error("RankSmarterAnalyze is missing. Check js/analysis.js is loaded.");

    const k = Number(kInput && kInput.value ? kInput.value : 1);
    const eps = Number(epsInput && epsInput.value ? epsInput.value : 0);

    const result = window.RankSmarterAnalyze(data, k, eps);
    lastResult = result;
    lastMc = null;
    hide(mcBlock);

    const fmt = result.fmt;
    const b = result.boundary; // from new analysis.js: requiredEpsForGuarantee, etc.
    const regions = result.regions;
    const sugg = result.suggestions;

    show(verdict);
    show(details);

    const n = result.meta.n;
    const chosenK = result.meta.k;
    const epsVal = result.meta.eps;

    // Region summaries
    const gIn = regions.guaranteedIn;          // {fromRank,toRank}
    const gOut = regions.guaranteedOut;        // {fromRank,toRank}
    const tb = regions.tieBand;                // null or {loRank,hiRank,size,spansBoundary,items:[...]}

    // 1) Primary verdict and recommended action
    if (!tb && result.stableSelectedSet) {
      setVerdictPill("Cutoff is defensible", "pill-good");

      if (verdictText) {
        verdictText.textContent =
          `With ±${fmt(epsVal)} scoring uncertainty, selecting the top ${chosenK} is stable. The boundary gap is large enough that the chosen cutoff will not flip under this error bound.`;
      }

      if (actionText) {
        actionText.textContent =
          `Recommendation: keep a strict cutoff at ${chosenK}.`;
      }

      if (whyText) {
        whyText.textContent =
          `${humanWiggleExplanation(epsVal)} For the boundary between rank ${chosenK} and ${chosenK + 1} to be guaranteed, scoring would need to be accurate within about ±${fmt(b.requiredEpsForGuarantee)}. You assumed ±${fmt(epsVal)}.`;
      }
    } else if (tb && tb.spansBoundary) {
      // This is the useful case: boundary sits inside a tie band
      setVerdictPill("Boundary is a tie band", "pill-warn");

      const L = tb.loRank;
      const U = tb.hiRank;

      const safeIn = gIn.toRank;      // could be 0
      const safeOutFrom = gOut.fromRank;

      if (verdictText) {
        verdictText.textContent =
          `At ±${fmt(epsVal)} scoring uncertainty, the cutoff at ${chosenK} falls inside a near-tie. Ranks ${L} to ${U} are mathematically indistinguishable under your stated error bound.`;
      }

      // The “5 vs 6 close but 7 far below” case is exactly: tie band might be 5–6, and guaranteed out starts at 7.
      if (actionText) {
        const parts = [];
        if (safeIn >= 1) parts.push(`Guaranteed in: ranks 1 to ${safeIn}.`);
        parts.push(`Tie band: ranks ${L} to ${U}.`);
        if (safeOutFrom <= n) parts.push(`Guaranteed out: ranks ${safeOutFrom} to ${n}.`);

        const cutParts = [];
        cutParts.push(`If you need a hard cutoff, you have two defensible options:`);
        cutParts.push(`Conservative cutoff: select top ${sugg.conservativeCutoffK}.`);
        cutParts.push(`Inclusive cutoff: select top ${sugg.inclusiveCutoffK}.`);

        actionText.textContent = `${parts.join(" ")} ${cutParts.join(" ")}`;
      }

      if (whyText) {
        whyText.textContent =
          `${humanWiggleExplanation(epsVal)} Your chosen boundary is forced only if ε is below about ±${fmt(b.requiredEpsForGuarantee)} at the (N, N+1) gap. Here ε is larger, so the ordering can flip within the band. The items outside the band remain separated by gaps larger than 2ε, which is why they are “guaranteed” in or out.`;
      }
    } else {
      // Fallback: should be rare with the new band logic, but keep sane messaging
      setVerdictPill("Cutoff needs caution", "pill-warn");

      if (verdictText) {
        verdictText.textContent =
          `At ±${fmt(epsVal)} scoring uncertainty, the cutoff at ${chosenK} is not reliably stable. Treat the boundary with caution.`;
      }

      if (actionText) {
        actionText.textContent =
          `Recommendation: either tighten the scoring process (reduce uncertainty) or treat the boundary as a tie band and use a secondary criterion.`;
      }

      if (whyText) {
        whyText.textContent =
          `Forced accuracy at the boundary is about ±${fmt(b.requiredEpsForGuarantee)}. You assumed ±${fmt(epsVal)}.`;
      }
    }

    // 2) Boundary details table
    renderTable(boundaryTable,
      ["Field", "Value"],
      [
        ["Chosen selection size (N)", `${chosenK}`],
        ["Boundary pair", `Rank ${chosenK} vs rank ${chosenK + 1}`],
        ["Inside at boundary", `${escapeHtml(b.insideItem)} = ${b.insideScore}`],
        ["Outside at boundary", `${escapeHtml(b.outsideItem)} = ${b.outsideScore}`],
        ["Gap at boundary", `${fmt(b.gap)}`],
        ["Accuracy required for guaranteed cutoff", `±${fmt(b.requiredEpsForGuarantee)}`],
        ["Your stated wiggle room", `±${fmt(epsVal)}`]
      ]
    );

    // 3) Tie band explanation box
    if (tieBandBox) {
      if (tb && tb.spansBoundary) {
        const L = tb.loRank;
        const U = tb.hiRank;

        const safeIn = regions.guaranteedIn.toRank;
        const safeOutFrom = regions.guaranteedOut.fromRank;

        let msg = "";
        if (safeIn >= 1) msg += `Guaranteed in (stable under ±${fmt(epsVal)}): ranks 1 to ${safeIn}. `;
        msg += `Tie band (cannot justify a strict cutoff inside this region): ranks ${L} to ${U}. `;
        if (safeOutFrom <= n) msg += `Guaranteed out: ranks ${safeOutFrom} to ${n}. `;
        msg += `If you want a strict rule, choose either conservative (top ${sugg.conservativeCutoffK}) or inclusive (top ${sugg.inclusiveCutoffK}).`;

        tieBandBox.innerHTML = msg;
      } else {
        tieBandBox.textContent =
          "No tie band around the cutoff at this wiggle room. The boundary gap is larger than the error bound, so the chosen cutoff is stable under this model.";
      }
    }

    // 4) Preview table (top 20) with highlighting for tie band and boundary
    const maxRows = Math.min(20, result.sorted.length);
    const tbLo = tb ? tb.loRank : null;
    const tbHi = tb ? tb.hiRank : null;

    const preview = result.sorted.slice(0, maxRows).map((r, i) => {
      const rank = i + 1;

      const isBoundaryPair = (rank === chosenK || rank === chosenK + 1);
      const isInTieBand = (tbLo !== null && tbHi !== null && rank >= tbLo && rank <= tbHi);

      const rankCell = isBoundaryPair ? `<strong>${rank}</strong>` : `${rank}`;
      const itemCell = isBoundaryPair ? `<strong>${escapeHtml(r.item)}</strong>` : escapeHtml(r.item);
      const scoreCell = isBoundaryPair ? `<strong>${r.score}</strong>` : `${r.score}`;

      const note = isInTieBand ? `<span class="tag">tie band</span>` : "";

      return [rankCell, itemCell, scoreCell + (note ? ` ${note}` : "")];
    });

    renderTable(previewTable, ["Rank", "Item", "Score"], preview);

    // 5) Enable exports (if export functions exist)
    if (exportJsonBtn) exportJsonBtn.disabled = !exists(window.RankSmarterExportJSON);
    if (exportMarkdownBtn) exportMarkdownBtn.disabled = !exists(window.RankSmarterExportMarkdown);
  }

  if (runAnalysisBtn) {
    runAnalysisBtn.addEventListener("click", () => {
      try { runAnalysis(); }
      catch (err) { alert(err && err.message ? err.message : String(err)); }
    });
  }

  // ---------- Monte Carlo (optional) ----------
  if (runMcBtn) {
    runMcBtn.addEventListener("click", () => {
      try {
        if (!window.RankSmarterMonteCarlo) {
          alert("Monte Carlo module not loaded. Check js/montecarlo.js is included.");
          return;
        }

        if (!lastResult) runAnalysis();
        if (!lastResult) return;

        const eps = Number(epsInput && epsInput.value ? epsInput.value : 0);
        const k = Number(kInput && kInput.value ? kInput.value : 1);

        const samples = Math.max(200, Math.min(20000, Number(mcSamples && mcSamples.value ? mcSamples.value : 2000)));
        const seed = Math.max(0, Math.min(999999999, Number(mcSeed && mcSeed.value ? mcSeed.value : 12345)));

        const mc = window.RankSmarterMonteCarlo(lastResult.sorted, k, eps, samples, seed);
        lastMc = mc;

        show(mcBlock);

        if (mcSummary) {
          mcSummary.textContent =
            `Selected set unchanged in ${(mc.sameSetProb * 100).toFixed(1)}% of trials. Average overlap is ${(mc.avgOverlapFrac * 100).toFixed(1)}%.`;
        }

        const rows = (mc.inclusionTop || []).map(x => [
          escapeHtml(x.item),
          (x.prob * 100).toFixed(1) + "%"
        ]);

        renderTable(mcTable, ["Item", "P(in selected set)"], rows);
      } catch (err) {
        alert(err && err.message ? err.message : String(err));
      }
    });
  }

  // ---------- Exports ----------
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      if (!lastResult) return;
      if (!window.RankSmarterExportJSON) { alert("Export JSON module not loaded."); return; }
      window.RankSmarterExportJSON(lastResult, lastMc);
    });
  }

  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener("click", () => {
      if (!lastResult) return;
      if (!window.RankSmarterExportMarkdown) { alert("Export report module not loaded."); return; }
      window.RankSmarterExportMarkdown(lastResult, lastMc);
    });
  }

  // Disable exports until there is a result
  if (exportJsonBtn) exportJsonBtn.disabled = true;
  if (exportMarkdownBtn) exportMarkdownBtn.disabled = true;
})();
