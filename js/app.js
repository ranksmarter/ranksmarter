import { analyze } from "./analysis.js";
import { monteCarlo } from "./montecarlo.js";
import { exportJSON, exportMarkdown } from "./export.js";

let data = [];

/* ---------------------------
   Maths modal: never show on load
---------------------------- */
function setupMathModal() {
  const modal = document.getElementById("mathModal");
  const openA = document.getElementById("openMath");
  const openB = document.getElementById("openMathHero");
  const closeBtn = modal ? modal.querySelector(".closeModal") : null;

  if (!modal) return;

  // Force hidden on load, regardless of any cached DOM state
  modal.classList.add("hidden");

  const open = (e) => {
    if (e) e.preventDefault();
    modal.classList.remove("hidden");
  };

  const close = (e) => {
    if (e) e.preventDefault();
    modal.classList.add("hidden");
  };

  if (openA) openA.addEventListener("click", open);
  if (openB) openB.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);

  // Clicking the dark backdrop closes (clicking inside modal-content does not)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close(e);
  });

  // Escape closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close(e);
    }
  });
}

/* ---------------------------
   CSV parsing
---------------------------- */
function parseCSV(text) {
  // Minimal safe parser for simple CSVs: item,score (no quoted commas)
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Skip header line
  const rows = lines.slice(1);

  return rows
    .map((r) => {
      const parts = r.split(",");
      const item = (parts[0] ?? "").trim();
      const score = parseFloat((parts[1] ?? "").trim());
      return { item, score };
    })
    .filter((x) => x.item && Number.isFinite(x.score));
}

/* ---------------------------
   Main UI wiring
---------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  setupMathModal();

  const fileInput = document.getElementById("fileInput");
  const controls = document.getElementById("controls");
  const runBtn = document.getElementById("runAnalysis");

  const kInput = document.getElementById("kInput");
  const epsInput = document.getElementById("epsInput");
  const epsValue = document.getElementById("epsValue");

  const verdict = document.getElementById("verdict");
  const verdictText = document.getElementById("verdictText");
  const actionText = document.getElementById("actionText");

  const exportJsonBtn = document.getElementById("exportJson");
  const exportMarkdownBtn = document.getElementById("exportMarkdown");

  if (!fileInput || !controls || !runBtn) return;

  // Show slider value live (if you have epsValue span in HTML)
  if (epsInput && epsValue) {
    const sync = () => { epsValue.textContent = `±${Number(epsInput.value).toFixed(2)}`; };
    epsInput.addEventListener("input", sync);
    sync();
  }

  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const text = await f.text();
    data = parseCSV(text);

    if (data.length < 2) {
      alert("CSV needs at least 2 valid rows with item,score.");
      return;
    }

    // Default k if empty
    if (kInput && !kInput.value) {
      kInput.value = String(Math.min(5, Math.max(1, data.length - 1)));
    }

    controls.classList.remove("hidden");
  });

  runBtn.addEventListener("click", () => {
    if (!data || data.length < 2) {
      alert("Upload a CSV first.");
      return;
    }

    const k = parseInt(kInput.value, 10);
    const eps = parseFloat(epsInput.value);

    if (!Number.isFinite(k) || k < 1 || k >= data.length) {
      alert(`Selection size must be between 1 and ${data.length - 1}.`);
      return;
    }
    if (!Number.isFinite(eps) || eps < 0) {
      alert("Wiggle room must be a non-negative number.");
      return;
    }

    const result = analyze(data, k, eps);

    verdict.classList.remove("hidden");
    verdictText.textContent = result.stable ? "Defensible cutoff." : "Likely fake precision.";

    actionText.textContent =
      `To keep this selection stable, scoring must be accurate within ±${result.required.toFixed(3)}.`;

    // Export buttons
    exportJsonBtn.onclick = () => exportJSON(result);
    exportMarkdownBtn.onclick = () => exportMarkdown(result);

    // If you have MC features wired elsewhere, keep them there.
    // This file imports monteCarlo to preserve parity with your structure.
    // You can hook it to a button later without breaking anything.
    void monteCarlo;
  });
});
