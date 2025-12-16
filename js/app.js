import { analyze } from "./analysis.js";
import { monteCarlo } from "./montecarlo.js";
import { exportJSON, exportMarkdown } from "./export.js";

let data = [];

document.getElementById("fileInput").addEventListener("change", async e => {
  const text = await e.target.files[0].text();
  data = text.split("\n").slice(1).map(r=>{
    const [item,score] = r.split(",");
    return { item, score: parseFloat(score) };
  }).filter(x=>!isNaN(x.score));
  document.getElementById("controls").classList.remove("hidden");
});

document.getElementById("runAnalysis").onclick = () => {
  const k = parseInt(document.getElementById("kInput").value);
  const eps = parseFloat(document.getElementById("epsInput").value);
  const result = analyze(data, k, eps);

  document.getElementById("verdict").classList.remove("hidden");
  document.getElementById("verdictText").textContent =
    result.stable ? "Defensible cutoff." : "Likely fake precision.";

  document.getElementById("actionText").textContent =
    `To keep this selection stable, scoring must be accurate within ±${result.required.toFixed(3)}.`;

  document.getElementById("exportJson").onclick = ()=>exportJSON(result);
  document.getElementById("exportMarkdown").onclick = ()=>exportMarkdown(result);
};
