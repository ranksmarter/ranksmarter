// export.js (global)
// Provides window.RankSmarterExportJSON(result, mc)
// Provides window.RankSmarterExportMarkdown(result, mc)

(function () {
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJSON(result, mc) {
    const payload = {
      generated_at: new Date().toISOString(),
      tool: "RankSmarter",
      result,
      monte_carlo: mc || null
    };
    download("ranksmarter_result.json", JSON.stringify(payload, null, 2), "application/json");
  }

  function exportMarkdown(result, mc) {
    const b = result.boundary;
    const fmt = result.fmt || ((x) => String(x));

    const bandText = result.band
      ? `Treat ranks ${result.band.loRank} to ${result.band.hiRank} as a tie band.`
      : "No tie band at the cutoff at this wiggle room.";

    const mcText = mc
      ? `\n## Stress test (Monte Carlo)\n- Samples: ${mc.samples}\n- Same selected set: ${(mc.sameSetProb * 100).toFixed(1)}%\n- Average overlap: ${(mc.avgOverlapFrac * 100).toFixed(1)}%\n`
      : "";

    const topPreview = result.sorted.slice(0, Math.min(20, result.sorted.length))
      .map((r, i) => `| ${i + 1} | ${r.item} | ${r.score} |`)
      .join("\n");

    const md = `# RankSmarter report

Generated: ${new Date().toLocaleString()}

## Inputs
- Items: ${result.meta.n}
- Selection size (cutoff): Top ${result.meta.k}
- Wiggle room (ε): ±${fmt(result.meta.eps)}

## Verdict
- ${result.stable ? "Defensible cutoff at the stated wiggle room." : "Likely fake precision at the stated wiggle room."}

## Boundary evidence
- Inside (rank ${result.meta.k}): ${b.insideItem} = ${b.insideScore}
- Outside (rank ${result.meta.k + 1}): ${b.outsideItem} = ${b.outsideScore}
- Gap: ${fmt(b.gap)}
- Forced accuracy required to prevent a flip: ±${fmt(b.required)}

## Recommendation
${bandText}

${mcText}
## Top items (preview)

| Rank | Item | Score |
|------|------|-------|
${topPreview}

Note: This checks precision (stability under bounded error), not validity or fairness.
`;

    download("ranksmarter_report.md", md, "text/markdown");
  }

  window.RankSmarterExportJSON = exportJSON;
  window.RankSmarterExportMarkdown = exportMarkdown;
})();
